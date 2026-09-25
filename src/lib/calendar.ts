// Motor de resolución del calendario: dado un rango de fechas y las
// pricing_rules aplicadas (rule_applications) a cada propiedad, calcula el
// precio y las noches mínimas finales por día y los guarda en calendar_days
// (tabla materializada que lee el buscador público y el calendario del host).
//
// Empate de prioridad: gana pricing_rules.priority más alto; si hay empate,
// gana la aplicación creada más recientemente.
//
// Fin de semana (para el precio base sin reglas) = noche de viernes o
// sábado. Ajustable después si Christian maneja otro criterio.
import type { SupabaseClient } from '@supabase/supabase-js'

type PropertyBase = {
  id: string
  weekday_price_mxn: number
  weekend_price_mxn: number
  min_nights: number
  // Noches mínimas por día de la semana (llave "0".."6", 0=domingo), solo
  // para los días que el host sobreescribió al crear/editar la propiedad —
  // los demás siguen usando min_nights. Ver migración min_nights_by_day.
  min_nights_by_day: Record<string, number> | null
  extra_guest_fee_mxn: number
}

type ApplicationRow = {
  property_id: string
  start_date: string
  end_date: string
  created_at: string
  rule_id: string
  pricing_rules: {
    id: string
    min_nights: number | null
    price_override_mxn: number | null
    price_adjustment_pct: number | null
    extra_guest_fee_mxn: number | null
    priority: number
  } | null
}

function toDateOnly(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function isWeekendNight(dateStr: string) {
  // 0=domingo … 6=sábado (mismo criterio que allowed_arrival_days)
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay()
  return day === 5 || day === 6
}

function eachDate(start: string, end: string): string[] {
  const dates: string[] = []
  const cur = new Date(`${start}T00:00:00Z`)
  const last = new Date(`${end}T00:00:00Z`)
  while (cur <= last) {
    dates.push(toDateOnly(cur))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return dates
}

/**
 * Recalcula calendar_days para las propiedades dadas, en el rango
 * [startDate, endDate] (inclusive, formato YYYY-MM-DD).
 */
export async function recomputeCalendarRange(
  supabase: SupabaseClient,
  propertyIds: string[],
  startDate: string,
  endDate: string
) {
  if (propertyIds.length === 0) return

  const [{ data: properties }, { data: applications }, { data: overrides }] = await Promise.all([
    supabase
      .from('properties')
      .select('id, weekday_price_mxn, weekend_price_mxn, min_nights, min_nights_by_day, extra_guest_fee_mxn')
      .in('id', propertyIds),
    supabase
      .from('rule_applications')
      .select(
        'property_id, start_date, end_date, created_at, rule_id, pricing_rules(id, min_nights, price_override_mxn, price_adjustment_pct, extra_guest_fee_mxn, priority)'
      )
      .in('property_id', propertyIds)
      .lte('start_date', endDate)
      .gte('end_date', startDate),
    supabase
      .from('min_nights_overrides')
      .select('property_id, date, min_nights')
      .in('property_id', propertyIds)
      .gte('date', startDate)
      .lte('date', endDate),
  ])

  const propertyMap = new Map<string, PropertyBase>((properties ?? []).map((p) => [p.id, p]))
  const apps = (applications ?? []) as unknown as ApplicationRow[]
  const overrideMap = new Map<string, number>(
    (overrides ?? []).map((o) => [`${o.property_id}|${o.date}`, o.min_nights])
  )

  const dates = eachDate(startDate, endDate)
  const rows: {
    property_id: string
    date: string
    price_mxn: number
    min_nights: number
    is_available: boolean
    applied_rule_id: string | null
    extra_guest_fee_mxn: number
  }[] = []

  for (const propertyId of propertyIds) {
    const property = propertyMap.get(propertyId)
    if (!property) continue

    const propertyApps = apps.filter((a) => a.property_id === propertyId)

    for (const date of dates) {
      const covering = propertyApps.filter((a) => a.start_date <= date && a.end_date >= date && a.pricing_rules)

      covering.sort((a, b) => {
        const pa = a.pricing_rules!.priority
        const pb = b.pricing_rules!.priority
        if (pa !== pb) return pb - pa
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      const winner = covering[0]?.pricing_rules ?? null
      const basePrice = isWeekendNight(date) ? property.weekend_price_mxn : property.weekday_price_mxn

      let price = basePrice
      if (winner?.price_override_mxn != null) {
        price = Number(winner.price_override_mxn)
      } else if (winner?.price_adjustment_pct != null) {
        price = Math.round(basePrice * (1 + Number(winner.price_adjustment_pct) / 100) * 100) / 100
      }

      // Orden de prioridad para noches mínimas: 1) override manual de esta
      // fecha exacta, 2) regla de precio vigente ese día, 3) el mínimo por
      // día de la semana que el host haya fijado en la propiedad, 4) el
      // mínimo general de la propiedad.
      const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay()
      const baseMinNights = property.min_nights_by_day?.[String(dayOfWeek)] ?? property.min_nights
      const override = overrideMap.get(`${propertyId}|${date}`)
      const minNights = override ?? winner?.min_nights ?? baseMinNights
      const extraGuestFee = winner?.extra_guest_fee_mxn ?? property.extra_guest_fee_mxn

      rows.push({
        property_id: propertyId,
        date,
        price_mxn: price,
        min_nights: minNights,
        is_available: true,
        applied_rule_id: winner?.id ?? null,
        extra_guest_fee_mxn: Number(extraGuestFee),
      })
    }
  }

  // Supabase/Postgres upsert en bloques para no exceder límites de payload.
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const { error } = await supabase
      .from('calendar_days')
      .upsert(chunk, { onConflict: 'property_id,date' })
    if (error) throw new Error(`No se pudo recalcular el calendario: ${error.message}`)
  }
}

export function monthRange(year: number, month: number) {
  // month: 1-12
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 0))
  return { start: toDateOnly(start), end: toDateOnly(end) }
}

export function daysInMonth(year: number, month: number) {
  return eachDate(monthRange(year, month).start, monthRange(year, month).end)
}

// Desplaza (año, mes) por `delta` meses (puede ser negativo). month: 1-12.
export function shiftMonth(year: number, month: number, delta: number) {
  const total = year * 12 + (month - 1) + delta
  const newYear = Math.floor(total / 12)
  const newMonth = (total % 12 + 12) % 12 + 1
  return { year: newYear, month: newMonth }
}

// Noches de una estancia: [checkIn, checkOut) — incluye checkIn, excluye
// checkOut (la noche del checkout ya no se cobra). Usado por el buscador
// público para saber qué días de calendar_days sumar.
export function nightsBetween(checkIn: string, checkOut: string): string[] {
  if (checkOut <= checkIn) return []
  const dates: string[] = []
  const cur = new Date(`${checkIn}T00:00:00Z`)
  const end = new Date(`${checkOut}T00:00:00Z`)
  while (cur < end) {
    dates.push(toDateOnly(cur))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return dates
}
