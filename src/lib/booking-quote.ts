// Cálculo de precio/disponibilidad para UNA propiedad y un rango de fechas —
// misma lógica que usa la página de cada cabaña, extraída aquí para que el
// checkout cobre exactamente el mismo total que se le mostró al huésped (una
// sola fuente de verdad, nunca confiar en un total que mande el navegador).
import type { SupabaseClient } from '@supabase/supabase-js'
import { recomputeCalendarRange, nightsBetween, isWeekendNight } from '@/lib/calendar'
import type { GuestCounts, OccupancyProperty } from '@/lib/occupancy'
import { fitsProperty, occupantsFor } from '@/lib/occupancy'

export type QuoteProperty = OccupancyProperty & {
  id: string
  weekday_price_mxn: number
  weekend_price_mxn: number
  extra_guest_fee_mxn: number
  min_nights: number
}

export type BookingQuote = {
  nights: string[]
  total: number
  minNightsRequired: number
  minNightsOk: boolean
  fitsGuests: boolean
  isFree: boolean
  // Si alguna noche tiene "mínimo de personas a cobrar" mayor a los que
  // vienen, aquí va ese mínimo (para avisar al huésped); si no, null.
  minGuestsCharged: number | null
}

export async function getBookingQuote(
  supabase: SupabaseClient,
  property: QuoteProperty,
  checkin: string,
  checkout: string,
  guests: GuestCounts
): Promise<BookingQuote> {
  const nights = nightsBetween(checkin, checkout)
  const fitsGuests = fitsProperty(property, guests)

  if (nights.length === 0) {
    return { nights, total: 0, minNightsRequired: property.min_nights, minNightsOk: false, fitsGuests, isFree: false, minGuestsCharged: null }
  }

  const lastNight = nights[nights.length - 1]
  await recomputeCalendarRange(supabase, [property.id], checkin, lastNight)

  const [{ data: days }, { data: blocked }, { data: minGuestRows }] = await Promise.all([
    supabase
      .from('calendar_days')
      .select('date, price_mxn, extra_guest_fee_mxn, min_nights')
      .eq('property_id', property.id)
      .gte('date', checkin)
      .lte('date', lastNight),
    supabase.from('blocked_dates').select('date').eq('property_id', property.id).gte('date', checkin).lte('date', lastNight),
    supabase
      .from('min_guests_overrides')
      .select('date, min_guests')
      .eq('property_id', property.id)
      .gte('date', checkin)
      .lte('date', lastNight),
  ])

  const dayMap = new Map((days ?? []).map((d) => [d.date, d]))
  const blockedDates = new Set((blocked ?? []).map((b) => b.date))
  // Cobro mínimo por personas: en las noches con mínimo (p. ej. diciembre en
  // las cabañas familiares) se cobra como si vinieran al menos esas personas.
  const minGuestsMap = new Map((minGuestRows ?? []).map((r) => [r.date as string, Number(r.min_guests)]))
  const occupants = occupantsFor(property, guests)
  let minGuestsCharged: number | null = null

  let total = 0
  let minNightsRequired = property.min_nights
  let isFree = true

  for (const date of nights) {
    if (blockedDates.has(date)) isFree = false
    const minGuests = Math.min(minGuestsMap.get(date) ?? 0, property.capacity)
    if (minGuests > occupants) minGuestsCharged = Math.max(minGuestsCharged ?? 0, minGuests)
    const extraGuests = Math.max(0, Math.max(occupants, minGuests) - property.base_occupancy)
    const cd = dayMap.get(date)
    if (cd) {
      total += Number(cd.price_mxn) + Number(cd.extra_guest_fee_mxn) * extraGuests
      minNightsRequired = Math.max(minNightsRequired, cd.min_nights)
    } else {
      const base = isWeekendNight(date) ? property.weekend_price_mxn : property.weekday_price_mxn
      total += Number(base) + Number(property.extra_guest_fee_mxn) * extraGuests
    }
  }

  return {
    nights,
    total,
    minNightsRequired,
    minNightsOk: nights.length >= minNightsRequired,
    fitsGuests,
    isFree,
    minGuestsCharged,
  }
}
