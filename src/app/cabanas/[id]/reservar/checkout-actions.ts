'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { getStripe } from '@/lib/stripe'
import {
  getMercadoPagoPaymentClient,
  getMercadoPagoCustomerClient,
  getMercadoPagoCustomerCardClient,
  getMercadoPagoRefundClient,
} from '@/lib/mercadopago'
import { getBookingQuote, type QuoteProperty } from '@/lib/booking-quote'
import type { GuestCounts } from '@/lib/occupancy'
import { resolveAddons, type AddonSelection } from '@/lib/addons'
import { resolveDiscountCode } from '@/lib/discounts'
import { finalizeBooking, type GuestInfo } from './booking-finalize'

type PropertyWithHost = QuoteProperty & { host_id: string }

async function loadProperty(propertyId: string): Promise<PropertyWithHost> {
  const supabase = createServiceClient()
  const { data: property } = await supabase
    .from('properties')
    .select(
      'id, host_id, capacity, base_occupancy, max_children, max_infants, infants_count_toward_capacity, pet_friendly, weekday_price_mxn, weekend_price_mxn, extra_guest_fee_mxn, min_nights'
    )
    .eq('id', propertyId)
    .eq('status', 'published')
    .maybeSingle()
  if (!property) throw new Error('Cabaña no encontrada.')
  return property as PropertyWithHost
}

type CheckoutParams = {
  propertyId: string
  checkin: string
  checkout: string
  guests: GuestCounts
  guestInfo: GuestInfo
  // Extras opcionales elegidos por el huésped — solo id + cantidad, nunca
  // precio: el precio real siempre se vuelve a leer de la base de datos
  // (ver resolveAddons en @/lib/addons).
  addonSelections?: AddonSelection[]
  // Código de descuento escrito por el huésped — el monto real siempre se
  // vuelve a calcular en el servidor (ver resolveDiscountCode).
  discountCode?: string
}

// Valida un código de descuento y devuelve cuánto se descontaría, para que
// el checkout pueda mostrarlo ANTES de pagar. El cobro real vuelve a
// validar todo esto de cero (aquí y otra vez al confirmar la reserva) —
// esta función es solo para la vista previa en la UI.
export async function validateDiscountCodeAction(
  propertyId: string,
  checkin: string,
  checkout: string,
  guests: GuestCounts,
  code: string
) {
  const supabase = createServiceClient()
  const property = await loadProperty(propertyId)
  const quote = await getBookingQuote(supabase, property, checkin, checkout, guests)

  if (!quote.isFree || !quote.fitsGuests || !quote.minNightsOk) {
    return { error: 'Estas fechas ya no están disponibles.' }
  }

  const result = await resolveDiscountCode(supabase, property.host_id, propertyId, checkin, quote.nights.length, quote.total, code)
  if (!result.valid) return { error: result.error }

  return { discountAmount: result.discountAmount, code: result.code, description: result.description }
}

// ----------------------------------------------------------------------------
// Stripe
// ----------------------------------------------------------------------------

export async function createStripePaymentIntent(params: CheckoutParams) {
  const supabase = createServiceClient()
  const property = await loadProperty(params.propertyId)
  const quote = await getBookingQuote(supabase, property, params.checkin, params.checkout, params.guests)

  if (!quote.isFree) return { error: 'Estas fechas ya no están disponibles.' }
  if (!quote.fitsGuests) return { error: 'El número de huéspedes no cabe en esta cabaña.' }
  if (!quote.minNightsOk) return { error: `Estas fechas requieren mínimo ${quote.minNightsRequired} noches.` }
  if (quote.total <= 0) return { error: 'No se pudo calcular el precio de la reserva.' }

  const addons = await resolveAddons(supabase, property.host_id, params.propertyId, params.addonSelections ?? [])

  let discountAmount = 0
  if (params.discountCode) {
    const discountResult = await resolveDiscountCode(
      supabase,
      property.host_id,
      params.propertyId,
      params.checkin,
      quote.nights.length,
      quote.total,
      params.discountCode
    )
    if (!discountResult.valid) return { error: discountResult.error }
    discountAmount = discountResult.discountAmount
  }

  const chargeTotal = quote.total - discountAmount + addons.total

  const stripe = getStripe()

  const customer = await stripe.customers.create({
    name: params.guestInfo.name,
    email: params.guestInfo.email,
    phone: params.guestInfo.phone || undefined,
  })

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(chargeTotal * 100),
    currency: 'mxn',
    customer: customer.id,
    // Guarda el método de pago para poder cobrar depósitos por daños después,
    // fuera de la sesión del huésped (sin pedirle la tarjeta de nuevo).
    setup_future_usage: 'off_session',
    metadata: {
      property_id: params.propertyId,
      checkin: params.checkin,
      checkout: params.checkout,
      guest_name: params.guestInfo.name,
      guest_email: params.guestInfo.email,
    },
  })

  return {
    clientSecret: paymentIntent.client_secret,
    total: chargeTotal,
  }
}

export async function finalizeStripeBooking(paymentIntentId: string, params: CheckoutParams) {
  const stripe = getStripe()
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

  if (paymentIntent.status !== 'succeeded') {
    return { error: 'El pago todavía no se confirma. Espera un momento e intenta de nuevo.' }
  }

  const supabase = createServiceClient()
  const property = await loadProperty(params.propertyId)
  const addons = await resolveAddons(supabase, property.host_id, params.propertyId, params.addonSelections ?? [])

  const result = await finalizeBooking(supabase, {
    property,
    hostId: property.host_id,
    checkin: params.checkin,
    checkout: params.checkout,
    guests: params.guests,
    guestInfo: params.guestInfo,
    provider: 'stripe',
    providerFields: {
      stripe_customer_id: typeof paymentIntent.customer === 'string' ? paymentIntent.customer : null,
      stripe_payment_method_id:
        typeof paymentIntent.payment_method === 'string' ? paymentIntent.payment_method : null,
      stripe_payment_intent_id: paymentIntent.id,
    },
    totalCharged: paymentIntent.amount / 100,
    addonItems: addons.items,
    discountCode: params.discountCode,
  })

  if (!result.ok) {
    // Las fechas ya no estaban libres (o algo más falló) — devolvemos el
    // dinero, el huésped no debe pagar por una reserva que no se concretó.
    try {
      await stripe.refunds.create({ payment_intent: paymentIntent.id })
    } catch {
      // Si el reembolso también falla, Christian tendrá que revisarlo a mano
      // en el dashboard de Stripe — no hay más que hacer desde aquí.
    }
    return { error: result.error }
  }

  return { bookingId: result.bookingId }
}

// ----------------------------------------------------------------------------
// Mercado Pago
// ----------------------------------------------------------------------------

export async function createMercadoPagoPayment(
  params: CheckoutParams & {
    token: string
    paymentMethodId: string
    issuerId?: string
    installments: number
  }
) {
  const supabase = createServiceClient()
  const property = await loadProperty(params.propertyId)
  const quote = await getBookingQuote(supabase, property, params.checkin, params.checkout, params.guests)

  if (!quote.isFree) return { error: 'Estas fechas ya no están disponibles.' }
  if (!quote.fitsGuests) return { error: 'El número de huéspedes no cabe en esta cabaña.' }
  if (!quote.minNightsOk) return { error: `Estas fechas requieren mínimo ${quote.minNightsRequired} noches.` }
  if (quote.total <= 0) return { error: 'No se pudo calcular el precio de la reserva.' }

  const addons = await resolveAddons(supabase, property.host_id, params.propertyId, params.addonSelections ?? [])

  let mpDiscountAmount = 0
  if (params.discountCode) {
    const discountResult = await resolveDiscountCode(
      supabase,
      property.host_id,
      params.propertyId,
      params.checkin,
      quote.nights.length,
      quote.total,
      params.discountCode
    )
    if (!discountResult.valid) return { error: discountResult.error }
    mpDiscountAmount = discountResult.discountAmount
  }

  const chargeTotal = quote.total - mpDiscountAmount + addons.total

  const customerClient = getMercadoPagoCustomerClient()
  const cardClient = getMercadoPagoCustomerCardClient()
  const paymentClient = getMercadoPagoPaymentClient()

  // Mercado Pago no deja crear dos customers con el mismo email — si el
  // huésped ya reservó antes, reusamos su customer existente.
  let customerId: string
  const existing = await customerClient.search({ options: { email: params.guestInfo.email } })
  const found = existing.results?.[0]
  if (found?.id) {
    customerId = found.id
  } else {
    const created = await customerClient.create({
      body: {
        email: params.guestInfo.email,
        first_name: params.guestInfo.name,
      },
    })
    if (!created.id) return { error: 'No se pudo crear el cliente en Mercado Pago.' }
    customerId = created.id
  }

  const payment = await paymentClient.create({
    body: {
      transaction_amount: Math.round(chargeTotal * 100) / 100,
      token: params.token,
      description: `Reserva ${params.propertyId}`,
      installments: params.installments,
      payment_method_id: params.paymentMethodId,
      issuer_id: params.issuerId ? Number(params.issuerId) : undefined,
      capture: true,
      payer: {
        type: 'customer',
        id: customerId,
        email: params.guestInfo.email,
      },
    },
  })

  if (payment.status !== 'approved') {
    return {
      error:
        payment.status === 'in_process' || payment.status === 'pending'
          ? 'Tu banco está revisando el pago. Intenta con otra tarjeta o método.'
          : `El pago fue rechazado (${payment.status_detail ?? payment.status}). Intenta con otra tarjeta.`,
    }
  }

  // Guarda la tarjeta en el customer para poder cobrar depósitos por daños
  // después, sin pedirle la tarjeta de nuevo.
  let cardId: string | null = null
  try {
    const savedCard = await cardClient.create({ customerId, body: { token: params.token } })
    cardId = savedCard.id ?? null
  } catch {
    // Si falla el guardado de la tarjeta no cancelamos la reserva — el pago
    // ya se cobró correctamente, solo no habrá tarjeta guardada para
    // depósitos futuros.
  }

  const result = await finalizeBooking(supabase, {
    property,
    hostId: property.host_id,
    checkin: params.checkin,
    checkout: params.checkout,
    guests: params.guests,
    guestInfo: params.guestInfo,
    provider: 'mercadopago',
    providerFields: {
      mp_customer_id: customerId,
      mp_card_id: cardId,
      mp_payment_id: String(payment.id),
    },
    totalCharged: payment.transaction_amount ?? chargeTotal,
    addonItems: addons.items,
    discountCode: params.discountCode,
  })

  if (!result.ok) {
    try {
      const refundClient = getMercadoPagoRefundClient()
      await refundClient.create({ payment_id: String(payment.id) })
    } catch {
      // Si el reembolso también falla, Christian tendrá que revisarlo a mano
      // en el panel de Mercado Pago.
    }
    return { error: result.error }
  }

  return { bookingId: result.bookingId }
}
