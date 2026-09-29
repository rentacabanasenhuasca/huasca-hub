'use client'

import Link from 'next/link'

// Calendario de disponibilidad de todas las propiedades, para la página de
// inicio — igual a la tabla verde/naranja (Disponible/Reservado) del sitio
// anterior de Christian, pero con scroll continuo (rueda del mouse/trackpad)
// en vez de paginar por mes.

import { useEffect, useMemo, useRef } from 'react'

type Property = { id: string; name: string; cover_photo_url: string | null }
type BlockedDate = { property_id: string; date: string }

const WEEKDAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const DAY_COL_WIDTH = 40
const PROPERTY_COL_WIDTH = 180

function key(propertyId: string, date: string) {
  return `${propertyId}|${date}`
}

function parseDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00Z`)
}

function toDateOnly(d: Date) {
  return d.toISOString().slice(0, 10)
}

function eachDateInRange(start: string, end: string) {
  const dates: { date: string; dayOfMonth: number; weekday: number; year: number; month: number }[] = []
  const cur = parseDate(start)
  const last = parseDate(end)
  while (cur <= last) {
    dates.push({
      date: toDateOnly(cur),
      dayOfMonth: cur.getUTCDate(),
      weekday: cur.getUTCDay(),
      year: cur.getUTCFullYear(),
      month: cur.getUTCMonth() + 1,
    })
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return dates
}

export default function PublicAvailabilityGrid({
  properties,
  windowStart,
  windowEnd,
  blockedDates,
}: {
  properties: Property[]
  windowStart: string
  windowEnd: string
  blockedDates: BlockedDate[]
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const days = useMemo(() => eachDateInRange(windowStart, windowEnd), [windowStart, windowEnd])

  const monthGroups = useMemo(() => {
    const groups: { key: string; label: string; count: number }[] = []
    for (const d of days) {
      const gkey = `${d.year}-${d.month}`
      const last = groups[groups.length - 1]
      if (last && last.key === gkey) {
        last.count += 1
      } else {
        groups.push({ key: gkey, label: `${MONTH_LABELS[d.month - 1]} ${d.year}`, count: 1 })
      }
    }
    return groups
  }, [days])

  const blockedSet = useMemo(() => new Set(blockedDates.map((b) => key(b.property_id, b.date))), [blockedDates])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el!.scrollLeft += e.deltaY
        e.preventDefault()
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  if (properties.length === 0) return null

  return (
    <div>
      <div
        ref={scrollRef}
        className="overflow-x-auto rounded-xl border border-stone/15 bg-white"
      >
        <table className="border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: PROPERTY_COL_WIDTH }} />
            {days.map((d) => (
              <col key={d.date} style={{ width: DAY_COL_WIDTH }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="sticky left-0 bg-white z-10 border-b border-stone/15" />
              {monthGroups.map((g) => (
                <th
                  key={g.key}
                  colSpan={g.count}
                  className="px-2 py-1.5 text-left text-navy-deep border-b border-l border-stone/15 font-semibold text-xs whitespace-nowrap"
                >
                  {g.label}
                </th>
              ))}
            </tr>
            <tr>
              <th className="sticky left-0 bg-white z-10 text-left px-3 py-2 text-navy-deep border-b border-stone/15">
                Cabaña
              </th>
              {days.map((d) => (
                <th
                  key={d.date}
                  className={`px-1 py-2 text-center border-b border-stone/15 ${
                    d.weekday === 0 || d.weekday === 6 ? 'text-burnt-orange' : 'text-stone'
                  }`}
                >
                  <div>{WEEKDAY_LABELS[d.weekday]}</div>
                  <div className="font-medium">{d.dayOfMonth}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {properties.map((property) => (
              <tr key={property.id}>
                <td className="sticky left-0 bg-white z-10 px-2 py-2 text-navy-deep border-b border-stone/10 font-medium">
                  <div className="flex items-center gap-2 min-w-0">
                    <Link
                      href={`/cabanas/${property.id}`}
                      className="flex items-center gap-2 min-w-0 hover:underline"
                    >
                      {property.cover_photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={property.cover_photo_url}
                          alt=""
                          className="h-7 w-7 rounded-md object-cover shrink-0 border border-stone/15"
                        />
                      ) : (
                        <span className="h-7 w-7 rounded-md bg-cream shrink-0 border border-stone/15" />
                      )}
                      <span className="truncate">{property.name}</span>
                    </Link>
                  </div>
                </td>
                {days.map((d) => {
                  const isBlocked = blockedSet.has(key(property.id, d.date))
                  return (
                    <td
                      key={d.date}
                      title={isBlocked ? 'Reservado' : 'Disponible'}
                      className={`border-b border-l border-stone/10 h-8 ${
                        isBlocked ? 'bg-navy' : 'bg-gold/15'
                      }`}
                    />
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-stone">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-gold/15 border border-stone/15" />
          Disponible
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-navy" />
          Reservado
        </span>
        <span className="hidden sm:inline">Desplázate con el mouse/trackpad sobre el calendario</span>
      </div>
    </div>
  )
}
