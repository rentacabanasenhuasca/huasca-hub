'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireHost } from '@/lib/hosts'
import { recomputeCalendarRange } from '@/lib/calendar'
import { getStripe } from '@/lib/stripe'
import { getMercadoPagoRefundClient } from '@/lib/mercadopago'

export type Selection = { propertyId: string; date: string }

// Junta fechas sueltas de una misma propiedad en rangos contiguos, para no
// crear una fila de rule_applications por cada día suelto.
function toRanges(dates: string[]): { start: string; end: string }[] {
  const sorted = [...dates].sort()
  const ranges: { start: string; end: string }[] = []

  for (const date of sorted) {
    const last = ranges[ranges.length - 1]
    if (last) {
      const next = new Date(`${last.end}T00:00:00Z`)
      next.setUTCDate(next.getUTCDate() + 1)
      if (next.toISOString().slice(0, 10) === date) {
        last.end = date
        continue
      }
    }
    ranges.push({ start: date, end: date })
  }
  return ranges
}

export async function applyRuleToSelection(ruleId: string, selections: Selection[]) {
  const host = await requireHost()
  const supabase = await createClient()

  if (selections.length === 0) return { error: 'No hay fechas seleccionadas.' }

  // Verifica que la regla sea del host (RLS ya lo filtraría, pero validamos
  // para dar un mensaje claro).
  const { data: rule } = await supabase
    .from('pricing_rules')
    .select('id')
    .eq('id', ruleId)
    .eq('host_id', host.id)
    .maybeSingle()
  if (!rule) return { error: 'Esa regla no existe.' }

  const byProperty = new Map<string, string[]>()
  for (const s of selections) {
    const list = byProperty.get(s.propertyId) ?? []
    list.push(s.date)
    byProperty.set(s.propertyId, list)
  }

  const rows: { rule_id: string; property_id: string; start_date: string; end_date: string }[] = []
  for (const [propertyId, dates] of byProperty) {
    for (const range of toRanges(dates)) {
      rows.push({ rule_id: ruleId, property_id: propertyId, start_date: range.start, end_date: range.end })
    }
  }

  const { error } = await supabase.from('rule_applications').insert(rows)
  if (error) return { error: `No se pudo aplicar la regla: ${error.message}` }

  const propertyIds = [...byProperty.keys()]
  const allDates = selections.map((s) => s.date).sort()
  await recomputeCalendarRange(supabase, propertyIds, allDates[0], allDates[allDates.length - 1])

  revalidatePath('/admin/calendario')
  return { error: null }
}

// Trae (recalculando primero) los días de calendario para un rango extra,
// usado por el scroll infinito del calendario para ir cargando meses
// adicionales sin recargar la página.
export async function loadCalendarWindow(propertyIds: string[], startDate: string, endDate: string) {
  await requireHost()
  const supabase = await createClient()

  if (propertyIds.length === 0) return { days: [], blocked: [] }

  await recomputeCalendarRange(supabase, propertyIds, startDate, endDate)

  const [{ data }, { data: blocked }] = await Promise.all([
    supabase
      .from('calendar_days')
      .select('property_id, date, price_mxn, min_nights, applied_rule_id')
      .in('property_id', propertyIds)
      .gte('date', startDate)
      .lte('date', endDate),
    supabase
      .from('blocked_dates')
      .select('property_id, date, source, note, booking_id, external_summary, ical_sources(platform, label)')
      .in('property_id', propertyIds)
      .gte('date', startDate)
      .lte('date', endDate),
  ])

  return { days: data ?? [], blocked: blocked ?? [] }
}

// Detalle completo de una reserva directa, para el panel que se abre al
// hacer clic en una celda bloqueada del calendario. Verifica que la
// propiedad sea del host antes de regresar nada.
export async function getBookingDetails(bookingId: string) {
  const host = await requireHost()
  const supabase = await createClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select(
      'id, guest_name, guest_email, guest_phone, guest_notes, check_in, check_out, adults, children, infants, pets, status, total_price_mxn, payment_provider, created_at, property_id, properties(host_id, name)'
    )
    .eq('id', bookingId)
    .maybeSingle()

  const property = booking ? (Array.isArray(booking.properties) ? booking.properties[0] : booking.properties) : null
  if (!booking || !property || property.host_id !== host.id) {
    return { error: 'Esa reserva no existe.', booking: null }
  }

  return { error: null, booking: { ...booking, property_name: property.name } }
}

// Cancela una reserva directa: la marca como 'cancelled' y libera sus fechas
// bloqueadas (así el calendario vuelve a mostrarlas disponibles). El
// reembolso es opcional — Christian puede cancelar sin devolver el dinero
// (ej. no-show, cancelación fuera de política) o pedir el reembolso al
// proveedor si corresponde.
export async function cancelBooking(bookingId: string, refund: boolean) {
  const host = await requireHost()
  const supabase = await createClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select(
      'id, status, payment_provider, stripe_payment_intent_id, mp_payment_id, property_id, properties(host_id)'
    )
    .eq('id', bookingId)
    .maybeSingle()

  const property = booking ? (Array.isArray(booking.properties) ? booking.properties[0] : booking.properties) : null
  if (!booking || !property || property.host_id !== host.id) {
    return { error: 'Esa reserva no existe.' }
  }
  if (booking.status === 'cancelled') return { error: 'Esa reserva ya estaba cancelada.' }

  let warning: string | null = null
  if (refund) {
    try {
      if (booking.payment_provider === 'stripe' && booking.stripe_payment_intent_id) {
        const stripe = getStripe()
        await stripe.refunds.create({ payment_intent: booking.stripe_payment_intent_id })
      } else if (booking.payment_provider === 'mercadopago' && booking.mp_payment_id) {
        const refundClient = getMercadoPagoRefundClient()
        await refundClient.create({ payment_id: booking.mp_payment_id })
      } else {
        warning = 'La reserva se canceló, pero no se encontró el pago para reembolsar — revísalo a mano.'
      }
    } catch (err) {
      warning = `La reserva se canceló, pero el reembolso falló: ${(err as Error).message}. Revísalo a mano en el panel del proveedor.`
    }
  }

  const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId)
  if (error) return { error: `No se pudo cancelar: ${error.message}` }

  await supabase.from('blocked_dates').delete().eq('booking_id', bookingId)

  revalidatePath('/admin/calendario')
  return { error: null, warning }
}

// Mueve una reserva confirmada a otra cabaña del mismo host, conservando las
// mismas fechas. Verifica que la cabaña destino esté libre en ese rango
// antes de mover nada, y libera/rebloquea blocked_dates para que el
// calendario refleje el cambio de inmediato.
export async function moveBooking(bookingId: string, newPropertyId: string) {
  const host = await requireHost()
  const supabase = await createClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, property_id, check_in, check_out, status, properties(host_id)')
    .eq('id', bookingId)
    .maybeSingle()

  const property = booking ? (Array.isArray(booking.properties) ? booking.properties[0] : booking.properties) : null
  if (!booking || !property || property.host_id !== host.id) {
    return { error: 'Esa reserva no existe.' }
  }
  if (booking.status === 'cancelled') return { error: 'No puedes mover una reserva cancelada.' }
  if (newPropertyId === booking.property_id) return { error: 'Elige una cabaña distinta a la actual.' }

  const { data: newProperty } = await supabase
    .from('properties')
    .select('id')
    .eq('id', newPropertyId)
    .eq('host_id', host.id)
    .maybeSingle()
  if (!newProperty) return { error: 'Esa cabaña no existe.' }

  const nights: string[] = []
  for (
    let d = new Date(`${booking.check_in}T00:00:00Z`);
    d < new Date(`${booking.check_out}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    nights.push(d.toISOString().slice(0, 10))
  }

  const { data: conflicts } = await supabase
    .from('blocked_dates')
    .select('date')
    .eq('property_id', newPropertyId)
    .in('date', nights)
  if (conflicts && conflicts.length > 0) {
    return {
      error: `La cabaña destino ya tiene fechas ocupadas: ${conflicts.map((c) => c.date).join(', ')}.`,
    }
  }

  const { error: updateError } = await supabase
    .from('bookings')
    .update({ property_id: newPropertyId })
    .eq('id', bookingId)
  if (updateError) return { error: `No se pudo mover la reserva: ${updateError.message}` }

  await supabase.from('blocked_dates').delete().eq('booking_id', bookingId)
  const rows = nights.map((date) => ({
    property_id: newPropertyId,
    date,
    source: 'booking' as const,
    booking_id: bookingId,
  }))
  const { error: blockError } = await supabase.from('blocked_dates').insert(rows)
  if (blockError) {
    // No se pudieron bloquear las fechas en el destino — revierte el cambio
    // de propiedad para no dejar la reserva "movida" sin sus fechas bloqueadas.
    await supabase.from('bookings').update({ property_id: booking.property_id }).eq('id', bookingId)
    return { error: `No se pudo bloquear las fechas en la cabaña destino: ${blockError.message}` }
  }

  revalidatePath('/admin/calendario')
  return { error: null, oldPropertyId: booking.property_id, newPropertyId, dates: nights }
}

// Agrupa selecciones sueltas (propertyId+date) por propiedad, para poder
// hacer una sola consulta por propiedad en vez de una por celda.
function groupByProperty(selections: Selection[]) {
  const byProperty = new Map<string, string[]>()
  for (const s of selections) {
    const list = byProperty.get(s.propertyId) ?? []
    list.push(s.date)
    byProperty.set(s.propertyId, list)
  }
  return byProperty
}

// Bloquea o abre manualmente las fechas seleccionadas (independiente de los
// bloqueos que vengan de iCal/reservas). Al abrir, solo se quitan los
// bloqueos manuales — un bloqueo por iCal/reserva real sigue bloqueado,
// igual que en Airbnb no puedes "abrir" una fecha con una reserva real.
// Devuelve el estado final de blocked_dates para exactamente esas celdas,
// para que el cliente actualice su vista sin recargar toda la ventana.
export async function setManualBlock(selections: Selection[], blocked: boolean, note?: string | null) {
  await requireHost()
  const supabase = await createClient()

  if (selections.length === 0) return { error: 'No hay fechas seleccionadas.' }

  const byProperty = groupByProperty(selections)

  if (blocked) {
    const propertyIds = [...byProperty.keys()]; const dates = selections.map((s) => s.date); const { data: existing } = await supabase.from('blocked_dates').select('property_id, date, source').in('property_id', propertyIds).in('date', dates); const nonManualKeys = new Set((existing ?? []).filter((r) => r.source !== 'manual').map((r) => `${r.property_id}|${r.date}`)); const trimmedNote = note?.trim() || null; const rows = selections.filter((s) => !nonManualKeys.has(`${s.propertyId}|${s.date}`)).map((s) => ({ property_id: s.propertyId, date: s.date, source: 'manual' as const, note: trimmedNote }))
    const { error } = await supabase
      .from('blocked_dates')
      .upsert(rows, { onConflict: 'property_id,date' })
    if (error) return { error: `No se pudo bloquear: ${error.message}` }
  } else {
    const results = await Promise.all(
      [...byProperty.entries()].map(([propertyId, dates]) =>
        supabase.from('blocked_dates').delete().eq('property_id', propertyId).eq('source', 'manual').in('date', dates)
      )
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) return { error: `No se pudo abrir: ${failed.error.message}` }
  }

  const updated = await Promise.all(
    [...byProperty.entries()].map(([propertyId, dates]) =>
      supabase
        .from('blocked_dates')
        .select('property_id, date, source, note, booking_id, external_summary, ical_sources(platform, label)')
        .eq('property_id', propertyId)
        .in('date', dates)
    )
  )
  const blockedRows = updated.flatMap((r) => r.data ?? [])

  revalidatePath('/admin/calendario')
  return { error: null, keys: selections.map((s) => `${s.propertyId}|${s.date}`), blocked: blockedRows }
}

// Fija (o quita) la noche mínima para fechas exactas, con prioridad sobre el
// mínimo de la propiedad y sobre cualquier regla de precio — igual que el
// campo "Noches mínimas" del panel de fechas de Airbnb. minNights = null
// quita el override y vuelve al mínimo normal.
export async function setMinNightsOverride(selections: Selection[], minNights: number | null) {
  await requireHost()
  const supabase = await createClient()

  if (selections.length === 0) return { error: 'No hay fechas seleccionadas.' }
  if (minNights != null && minNights < 1) return { error: 'Las noches mínimas deben ser al menos 1.' }

  const byProperty = groupByProperty(selections)

  if (minNights != null) {
    const rows = selections.map((s) => ({ property_id: s.propertyId, date: s.date, min_nights: minNights }))
    const { error } = await supabase.from('min_nights_overrides').upsert(rows, { onConflict: 'property_id,date' })
    if (error) return { error: `No se pudo guardar: ${error.message}` }
  } else {
    const results = await Promise.all(
      [...byProperty.entries()].map(([propertyId, dates]) =>
        supabase.from('min_nights_overrides').delete().eq('property_id', propertyId).in('date', dates)
      )
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) return { error: `No se pudo quitar: ${failed.error.message}` }
  }

  const allDates = selections.map((s) => s.date).sort()
  await recomputeCalendarRange(supabase, [...byProperty.keys()], allDates[0], allDates[allDates.length - 1])

  const updated = await Promise.all(
    [...byProperty.entries()].map(([propertyId, dates]) =>
      supabase
        .from('calendar_days')
        .select('property_id, date, price_mxn, min_nights, applied_rule_id')
        .eq('property_id', propertyId)
        .in('date', dates)
    )
  )
  const days = updated.flatMap((r) => r.data ?? [])

  revalidatePath('/admin/calendario')
  return { error: null, days }
}

// Fija (o quita) el precio para fechas exactas, con prioridad absoluta sobre
// el precio base de la propiedad y sobre cualquier regla de precio vigente
// ese día — igual que "Noches mínimas" pero para precio. Se usa para
// cambiar el precio directamente al seleccionar celdas con el mouse, sin
// tener que crear/editar una regla. priceMxn = null quita el ajuste y
// vuelve al precio normal (base o regla aplicada).
export async function setPriceOverride(selections: Selection[], priceMxn: number | null) {
  await requireHost()
  const supabase = await createClient()

  if (selections.length === 0) return { error: 'No hay fechas seleccionadas.' }
  if (priceMxn != null && priceMxn < 0) return { error: 'El precio no puede ser negativo.' }

  const byProperty = groupByProperty(selections)

  if (priceMxn != null) {
    const rows = selections.map((s) => ({ property_id: s.propertyId, date: s.date, price_mxn: priceMxn }))
    const { error } = await supabase.from('price_overrides').upsert(rows, { onConflict: 'property_id,date' })
    if (error) return { error: `No se pudo guardar: ${error.message}` }
  } else {
    const results = await Promise.all(
      [...byProperty.entries()].map(([propertyId, dates]) =>
        supabase.from('price_overrides').delete().eq('property_id', propertyId).in('date', dates)
      )
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) return { error: `No se pudo quitar: ${failed.error.message}` }
  }

  const allDates = selections.map((s) => s.date).sort()
  await recomputeCalendarRange(supabase, [...byProperty.keys()], allDates[0], allDates[allDates.length - 1])

  const updated = await Promise.all(
    [...byProperty.entries()].map(([propertyId, dates]) =>
      supabase
        .from('calendar_days')
        .select('property_id, date, price_mxn, min_nights, applied_rule_id')
        .eq('property_id', propertyId)
        .in('date', dates)
    )
  )
  const days = updated.flatMap((r) => r.data ?? [])

  revalidatePath('/admin/calendario')
  return { error: null, days }
}

// Crea una reserva directamente desde el panel (sin pasar por Stripe/Mercado
// Pago) — por ejemplo cuando el huésped paga en efectivo, por transferencia,
// o Christian quiere registrar algo que ya cerró por WhatsApp. Se le puede
// poner el monto exacto que se cobró (puede ser distinto al precio de
// calendario). Bloquea las fechas igual que cualquier otra reserva directa.
export async function createManualBooking(input: {
  propertyId: string
  checkIn: string
  checkOut: string
  guestName: string
  guestEmail: string
  guestPhone: string
  adults: number
  children: number
  infants: number
  pets: boolean
  totalPriceMxn: number
  notes: string
}) {
  const host = await requireHost()
  const supabase = await createClient()

  if (!input.propertyId) return { error: 'Elige una cabaña.' }
  if (!input.guestName.trim()) return { error: 'Falta el nombre del huésped.' }
  if (!input.checkIn || !input.checkOut || input.checkOut <= input.checkIn) {
    return { error: 'Las fechas no son válidas — la salida debe ser después de la llegada.' }
  }
  if (!Number.isFinite(input.totalPriceMxn) || input.totalPriceMxn < 0) {
    return { error: 'El monto cobrado no es válido.' }
  }

  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('id', input.propertyId)
    .eq('host_id', host.id)
    .maybeSingle()
  if (!property) return { error: 'Esa cabaña no existe.' }

  const nights: string[] = []
  for (
    let d = new Date(`${input.checkIn}T00:00:00Z`);
    d < new Date(`${input.checkOut}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    nights.push(d.toISOString().slice(0, 10))
  }

  const { data: conflicts } = await supabase
    .from('blocked_dates')
    .select('date')
    .eq('property_id', input.propertyId)
    .in('date', nights)
  if (conflicts && conflicts.length > 0) {
    return { error: `Esa cabaña ya tiene fechas ocupadas en ese rango: ${conflicts.map((c) => c.date).join(', ')}.` }
  }

  const { data: booking, error } = await supabase
    .from('bookings')
    .insert({
      property_id: input.propertyId,
      guest_name: input.guestName.trim(),
      guest_email: input.guestEmail.trim() || null,
      guest_phone: input.guestPhone.trim() || null,
      guest_notes: input.notes.trim() || null,
      check_in: input.checkIn,
      check_out: input.checkOut,
      adults: input.adults,
      children: input.children,
      infants: input.infants,
      pets: input.pets,
      source: 'direct',
      status: 'confirmed',
      total_price_mxn: input.totalPriceMxn,
    })
    .select('id')
    .single()

  if (error || !booking) return { error: `No se pudo crear la reserva: ${error?.message}` }

  const rows = nights.map((date) => ({
    property_id: input.propertyId,
    date,
    source: 'booking' as const,
    booking_id: booking.id,
  }))
  const { error: blockError } = await supabase.from('blocked_dates').insert(rows)
  if (blockError) {
    // No se pudo bloquear las fechas — no dejamos la reserva "fantasma" sin
    // sus fechas protegidas, mejor se revierte y se avisa.
    await supabase.from('bookings').delete().eq('id', booking.id)
    return { error: `No se pudo bloquear las fechas: ${blockError.message}` }
  }

  revalidatePath('/admin/calendario')
  return {
    error: null,
    bookingId: booking.id,
    propertyId: input.propertyId,
    dates: nights,
  }
}

export async function removeApplication(applicationId: string) {
  await requireHost()
  const supabase = await createClient()

  const { data: app } = await supabase
    .from('rule_applications')
    .select('property_id, start_date, end_date')
    .eq('id', applicationId)
    .maybeSingle()

  const { error } = await supabase.from('rule_applications').delete().eq('id', applicationId)
  if (error) return { error: `No se pudo quitar: ${error.message}` }

  if (app) {
    await recomputeCalendarRange(supabase, [app.property_id], app.start_date, app.end_date)
  }

  revalidatePath('/admin/calendario')
  return { error: null }
}
