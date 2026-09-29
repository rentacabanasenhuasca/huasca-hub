import { createClient } from '@/lib/supabase/server'
import { requireHost } from '@/lib/hosts'
import { monthRange, recomputeCalendarRange, shiftMonth } from '@/lib/calendar'
import CalendarGrid from './CalendarGrid'

// Cuántos meses se precargan alrededor del mes pedido, para que el
// calendario se pueda desplazar (scroll) de mes en mes sin recargar la
// página. El scroll infinito del cliente va pidiendo más conforme te
// acercas a los bordes de esta ventana.
const MONTHS_BEFORE = 1
const MONTHS_AFTER = 3

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>
}) {
  const { y, m } = await searchParams
  const now = new Date()
  const year = y ? Number(y) : now.getUTCFullYear()
  const month = m ? Number(m) : now.getUTCMonth() + 1 // 1-12

  const host = await requireHost()
  const supabase = await createClient()

  const { data: properties } = await supabase
    .from('properties')
    .select('id, name, weekday_price_mxn, weekend_price_mxn, min_nights')
    .eq('host_id', host.id)
    .order('name')

  const { data: rules } = await supabase
    .from('pricing_rules')
    .select('id, name, color, priority')
    .eq('host_id', host.id)
    .order('priority', { ascending: false })

  const propertyIds = (properties ?? []).map((p) => p.id)

  const { data: photos } =
    propertyIds.length > 0
      ? await supabase
          .from('property_photos')
          .select('property_id, url, sort_order')
          .in('property_id', propertyIds)
          .order('sort_order', { ascending: true })
      : { data: [] as { property_id: string; url: string; sort_order: number }[] }

  const coverByProperty = new Map<string, string>()
  for (const photo of photos ?? []) {
    if (!coverByProperty.has(photo.property_id)) coverByProperty.set(photo.property_id, photo.url)
  }
  const propertiesWithPhotos = (properties ?? []).map((p) => ({
    ...p,
    cover_photo_url: coverByProperty.get(p.id) ?? null,
  }))

  const windowStartBound = shiftMonth(year, month, -MONTHS_BEFORE)
  const windowEndBound = shiftMonth(year, month, MONTHS_AFTER)
  const { start } = monthRange(windowStartBound.year, windowStartBound.month)
  const { end } = monthRange(windowEndBound.year, windowEndBound.month)

  if (propertyIds.length > 0) {
    // Siempre refresca la ventana visible: refleja precio base + reglas
    // vigentes, aunque calendar_days todavía no tuviera filas para estas
    // fechas.
    await recomputeCalendarRange(supabase, propertyIds, start, end)
  }

  const [{ data: calendarDays }, { data: applications }, { data: blockedDates }] = await Promise.all([
    propertyIds.length > 0
      ? supabase
          .from('calendar_days')
          .select('property_id, date, price_mxn, min_nights, applied_rule_id')
          .in('property_id', propertyIds)
          .gte('date', start)
          .lte('date', end)
      : Promise.resolve({ data: [] as never[] }),
    propertyIds.length > 0
      ? supabase
          .from('rule_applications')
          .select('id, property_id, start_date, end_date, rule_id, pricing_rules(name, color)')
          .in('property_id', propertyIds)
          .lte('start_date', end)
          .gte('end_date', start)
      : Promise.resolve({ data: [] as never[] }),
    propertyIds.length > 0
      ? supabase
          .from('blocked_dates')
          .select('property_id, date, source, note, booking_id, external_summary, ical_sources(platform, label)')
          .in('property_id', propertyIds)
          .gte('date', start)
          .lte('date', end)
      : Promise.resolve({ data: [] as never[] }),
  ])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-navy-deep">Calendario y precios</h1>
        <p className="text-sm text-stone mt-1">
          Selecciona celdas (arrastra o Cmd/Ctrl+click para varias) de una o varias propiedades y
          aplícales una regla. Administra las reglas en{' '}
          <a href="/admin/reglas" className="text-gold underline underline-offset-2">
            Reglas de precio
          </a>
          .
        </p>
      </div>

      {!properties || properties.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone/30 bg-white p-10 text-center text-stone">
          Crea al menos una propiedad para ver el calendario.
        </div>
      ) : (
        <CalendarGrid
          key={`${start}-${end}`}
          year={year}
          month={month}
          windowStart={start}
          windowEnd={end}
          properties={propertiesWithPhotos}
          rules={rules ?? []}
          calendarDays={calendarDays ?? []}
          applications={(applications ?? []) as unknown as Parameters<typeof CalendarGrid>[0]['applications']}
          blockedDates={blockedDates ?? []}
        />
      )}
    </div>
  )
}
