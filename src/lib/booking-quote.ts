// Cálculo de precio/disponibilidad para UNA propiedad y un rango de fechas —
// misma lógica que usa la página de cada cabaña, extraída aquí para que el
// checkout cobre exactamente el mismo total que se le mostró al huésped (una
// sola fuente de verdad, nunca confiar en un total que mande el navegador).
import type { SupabaseClient } from '@supabase/supabase-js'
import { recomputeCalendarRange, nightsBetween, isWeekendNight } from '@/lib/calendar'
import type { GuestCounts, OccupancyProperty } from '@/lib/occupancy'
import { fitsProperty, extraGuestsFor } from '@/lib/occupancy'

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
    return { nights, total: 0, minNightsRequired: property.min_nights, minNightsOk: false, fitsGuests, isFree: false }
  }

  const lastNight = nights[nights.length - 1]
  await recomputeCalendarRange(supabase, [property.id], checkin, lastNight)

  const [{ data: days }, { data: blocked }] = await Promise.all([
    supabase
      .from('calendar_days')
      .select('date, price_mxn, extra_guest_fee_mxn, min_nights')
      .eq('property_id', property.id)
      .gte('date', checkin)
      .lte('date', lastNight),
    supabase.from('blocked_dates').select('date').eq('property_id', property.id).gte('date', checkin).lte('date', lastNight),
  ])

  const dayMap = new Map((days ?? []).map((d) => [d.date, d]))
  const blockedDates = new Set((blocked ?? []).map((b) => b.date))
  const extraGuests = extraGuestsFor(property, guests)

  let total = 0
  let minNightsRequired = property.min_nights
  let isFree = true

  for (const date of nights) {
    if (blockedDates.has(date)) isFree = false
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
  }
}
