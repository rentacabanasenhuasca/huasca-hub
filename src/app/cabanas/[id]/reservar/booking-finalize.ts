// Lógica compartida para confirmar una reserva DESPUÉS de que el pago ya se
// autorizó con el proveedor (Stripe o Mercado Pago). No lleva 'use server'
// porque no es un archivo de acciones — lo llaman las acciones de
// checkout-actions.ts para ambos proveedores, así la creación del booking +
// blocked_dates + payments vive en un solo lugar.
import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { getBookingQuote, type QuoteProperty } from '@/lib/booking-quote'
import type { GuestCounts } from '@/lib/occupancy'
import { nightsBetween } from '@/lib/calendar'
import { sendBookingEmails } from '@/lib/booking-emails'
import type { ResolvedAddonItem } from '@/lib/addons'
import { resolveDiscountCode, applyDiscountUsage } from '@/lib/discounts'

export type GuestInfo = {
  name: string
  email: string
  phone: string
  notes?: string
}

export type FinalizeBookingInput = {
  property: QuoteProperty
  hostId: string
  checkin: string
  checkout: string
  guests: GuestCounts
  guestInfo: GuestInfo
  provider: 'stripe' | 'mercadopago'
  providerFields: Record<string, string | null>
  totalCharged: number
  addonItems?: ResolvedAddonItem[]
  // Código de descuento escrito por el huésped (crudo, sin validar) — se
  // vuelve a validar y calcular aquí mismo, nunca se confía en un monto que
  // haya calculado el cliente o una llamada anterior.
  discountCode?: string
}

export type FinalizeBookingResult =
  | { ok: true; bookingId: string }
  | { ok: false; error: string }

/**
 * Se llama DESPUÉS de que el proveedor ya autorizó/capturó el cobro. Vuelve
 * a validar disponibilidad (nunca confiar en que nada cambió entre que se
 * mostró el precio y que se confirmó el pago) y, si las fechas siguen
 * libres, crea el booking confirmado + bloquea las noches + registra el
 * pago. Si las fechas ya no están libres, regresa un error — quien llama
 * es responsable de reembolsar/cancelar el cobro con el proveedor.
 */
export async function finalizeBooking(
  supabase: SupabaseClient,
  input: FinalizeBookingInput
): Promise<FinalizeBookingResult> {
  const { property, hostId, checkin, checkout, guests, guestInfo, provider, providerFields, totalCharged, addonItems, discountCode } = input

  const quote = await getBookingQuote(supabase, property, checkin, checkout, guests)

  if (!quote.isFree) {
    return {
      ok: false,
      error:
        'Estas fechas se acaban de reservar mientras completabas el pago. No te preocupes, tu cobro será reembolsado automáticamente.',
    }
  }
  if (!quote.fitsGuests) {
    return { ok: false, error: 'El número de huéspedes ya no cabe en esta cabaña.' }
  }
  if (!quote.minNightsOk) {
    return { ok: false, error: `Estas fechas requieren mínimo ${quote.minNightsRequired} noches.` }
  }

  const nights = nightsBetween(checkin, checkout)

  let discountCodeId: string | null = null
  let discountCodeText: string | null = null
  let discountAmount = 0
  if (discountCode) {
    const discountResult = await resolveDiscountCode(supabase, hostId, property.id, checkin, nights.length, quote.total, discountCode)
    if (!discountResult.valid) {
      return { ok: false, error: discountResult.error }
    }
    discountCodeId = discountResult.discountCodeId
    discountCodeText = discountResult.code
    discountAmount = discountResult.discountAmount
  }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      property_id: property.id,
      guest_name: guestInfo.name,
      guest_email: guestInfo.email,
      guest_phone: guestInfo.phone,
      check_in: checkin,
      check_out: checkout,
      adults: guests.adults,
      children: guests.children,
      infants: guests.infants,
      pets: guests.pets > 0,
      source: 'direct',
      status: 'confirmed',
      total_price_mxn: totalCharged,
      payment_provider: provider,
      guest_notes: guestInfo.notes || null,
      discount_code_id: discountCodeId,
      discount_code: discountCodeText,
      discount_amount_mxn: discountAmount,
      ...providerFields,
    })
    .select('id')
    .single()

  if (bookingError || !booking) {
    return { ok: false, error: `No se pudo crear la reserva: ${bookingError?.message ?? 'error desconocido'}` }
  }

  const { error: blockError } = await supabase.from('blocked_dates').insert(
    nights.map((date) => ({
      property_id: property.id,
      date,
      source: 'booking' as const,
      booking_id: booking.id,
    }))
  )
  if (blockError) {
    // No dejamos un booking "confirmado" sin fechas bloqueadas ni fechas a
    // medio bloquear — se deshace todo para que las fechas queden libres de
    // nuevo y el huésped pueda reintentar limpio (el proveedor de pago
    // reembolsa el cobro, eso lo hace quien llama a finalizeBooking).
    await supabase.from('blocked_dates').delete().eq('booking_id', booking.id)
    await supabase.from('bookings').delete().eq('id', booking.id)
    return { ok: false, error: `No se pudieron bloquear las fechas, tu reserva no se completó: ${blockError.message}` }
  }

  const { error: paymentError } = await supabase.from('payments').insert({
    booking_id: booking.id,
    provider,
    total_amount_mxn: totalCharged,
    platform_fee: 0,
    host_payout: totalCharged,
    payout_status: 'pending',
  })
  if (paymentError) {
    // Mismo criterio: si no se pudo registrar el pago, deshacemos el
    // booking y liberamos las fechas en vez de dejarlas bloqueadas por una
    // reserva que técnicamente no quedó completa.
    await supabase.from('blocked_dates').delete().eq('booking_id', booking.id)
    await supabase.from('bookings').delete().eq('id', booking.id)
    return { ok: false, error: `No se pudo registrar el pago, tu reserva no se completó: ${paymentError.message}` }
  }

  // Extras seleccionados: se guardan como "foto" del precio/cantidad al
  // momento de la reserva (mejor esfuerzo, igual que los correos de abajo —
  // si esto falla no se revierte un cobro ya hecho, solo se pierde el
  // detalle itemizado de los extras en este booking).
  if (addonItems && addonItems.length > 0) {
    const { error: addonsError } = await supabase.from('booking_addons').insert(
      addonItems.map((item) => ({
        booking_id: booking.id,
        addon_id: item.addon_id,
        name: item.name,
        unit_price_mxn: item.unit_price_mxn,
        quantity: item.quantity,
        subtotal_mxn: item.subtotal_mxn,
      }))
    )
    if (addonsError) console.warn('[booking-addons]', addonsError.message)
  }

  // Igual que los correos de abajo: mejor esfuerzo. La reserva ya está
  // confirmada y el cobro ya se hizo, no se revierte nada por esto.
  if (discountCodeId) {
    try {
      await applyDiscountUsage(supabase, discountCodeId)
    } catch (err) {
      console.warn('[discount-usage] fallo inesperado:', (err as Error).message)
    }
  }

  revalidatePath('/admin/calendario')
  revalidatePath(`/cabanas/${property.id}`)
  revalidatePath('/')

  // Los correos son "mejor esfuerzo": si Resend falla o no está
  // configurado todavía, la reserva ya está confirmada y no se debe
  // revertir por esto — solo se registra en los logs del servidor.
  try {
    const { errors } = await sendBookingEmails(supabase, booking.id)
    if (errors.length > 0) console.warn('[booking-emails]', errors.join(' · '))
  } catch (err) {
    console.warn('[booking-emails] fallo inesperado:', (err as Error).message)
  }

  return { ok: true, bookingId: booking.id }
}
