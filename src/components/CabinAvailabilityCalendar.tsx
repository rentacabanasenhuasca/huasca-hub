'use client'

// Calendario de disponibilidad de UNA cabaña, para su propia página: un
// cuadro por mes (dos en pantallas grandes) con flechas para avanzar a los
// meses siguientes. Cada día muestra si esa noche está libre u ocupada.
// Además sirve para elegir fechas: un clic en la llegada y otro en la salida
// llenan la búsqueda de la página y se calcula el precio.
import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const WEEKDAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function addDays(date: string, n: number) {
  const x = new Date(`${date}T00:00:00Z`)
  x.setUTCDate(x.getUTCDate() + n)
  return x.toISOString().slice(0, 10)
}

function MonthGrid({
  year,
  month,
  today,
  windowEnd,
  blocked,
  start,
  end,
  onPick,
}: {
  year: number
  month: number
  today: string
  windowEnd: string
  blocked: Set<string>
  start: string | null
  end: string | null
  onPick: (date: string) => void
}) {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => ymd(year, month, i + 1)),
  ]

  return (
    <div>
      <p className="text-center font-medium text-navy-deep mb-3">
        {MONTHS[month]} {year}
      </p>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="text-[11px] font-medium text-stone pb-1">
            {w}
          </span>
        ))}
        {cells.map((date, i) => {
          if (!date) return <span key={`e${i}`} />
          const day = Number(date.slice(8))
          const outOfRange = date < today || date > windowEnd
          const isBlocked = blocked.has(date)
          const isEdge = date === start || date === end
          const inRange = start && end && date > start && date < end

          let cls = 'bg-gold/15 text-navy-deep hover:ring-2 hover:ring-gold cursor-pointer'
          let label = 'Disponible'
          if (outOfRange) {
            cls = 'text-stone/40 cursor-default'
            label = 'Fuera de fechas'
          } else if (isBlocked) {
            cls = 'bg-stone/10 text-stone/60 line-through cursor-pointer'
            label = 'No disponible'
          }
          if (inRange) cls = 'bg-gold/45 text-navy-deep cursor-pointer'
          if (isEdge) cls = 'bg-gold text-navy-deep font-semibold cursor-pointer'

          return (
            <button
              key={date}
              type="button"
              disabled={outOfRange}
              title={label}
              aria-label={`${day} de ${MONTHS[month]}: ${label}`}
              onClick={() => onPick(date)}
              className={`h-10 rounded-lg text-sm transition ${cls}`}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function CabinAvailabilityCalendar({
  blockedDates,
  today,
  windowEnd,
  checkin,
  checkout,
}: {
  blockedDates: string[]
  today: string
  windowEnd: string
  checkin?: string
  checkout?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const blocked = useMemo(() => new Set(blockedDates), [blockedDates])

  const [offset, setOffset] = useState(0)
  const [start, setStart] = useState<string | null>(checkin ?? null)
  const [end, setEnd] = useState<string | null>(checkout ?? null)
  const [message, setMessage] = useState<string | null>(null)

  const baseYear = Number(today.slice(0, 4))
  const baseMonth = Number(today.slice(5, 7)) - 1
  const monthAt = (n: number) => {
    const total = baseMonth + n
    return { year: baseYear + Math.floor(total / 12), month: ((total % 12) + 12) % 12 }
  }
  const lastOffset = (() => {
    const y = Number(windowEnd.slice(0, 4))
    const m = Number(windowEnd.slice(5, 7)) - 1
    return (y - baseYear) * 12 + (m - baseMonth)
  })()

  function nightsFree(from: string, to: string) {
    for (let d = from; d < to; d = addDays(d, 1)) {
      if (blocked.has(d)) return false
    }
    return true
  }

  function onPick(date: string) {
    setMessage(null)
    // Segundo clic: fecha de salida. La noche de salida no se cobra, así que
    // ese día puede estar ocupado (otro huésped llega ese mismo día).
    if (start && !end && date > start) {
      if (!nightsFree(start, date)) {
        setMessage('Hay noches ocupadas en medio de esas fechas. Elige otra salida.')
        return
      }
      setEnd(date)
      const params = new URLSearchParams(searchParams.toString())
      params.set('checkin', start)
      params.set('checkout', date)
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
      return
    }
    // Primer clic (o reinicio): fecha de llegada, esa noche tiene que estar libre.
    if (blocked.has(date)) {
      setMessage('Ese día no está disponible para llegar.')
      return
    }
    setStart(date)
    setEnd(null)
  }

  const first = monthAt(offset)
  const second = monthAt(offset + 1)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => setOffset((o) => Math.max(0, o - 1))}
          disabled={offset === 0}
          aria-label="Mes anterior"
          className="h-9 w-9 rounded-full border border-stone/20 text-navy-deep hover:bg-cream disabled:opacity-30 disabled:hover:bg-transparent transition"
        >
          ←
        </button>
        <p className="text-xs text-stone">
          {start && !end ? 'Ahora elige tu día de salida' : 'Toca un día libre para elegir tu llegada'}
        </p>
        <button
          type="button"
          onClick={() => setOffset((o) => Math.min(lastOffset, o + 1))}
          disabled={offset >= lastOffset}
          aria-label="Mes siguiente"
          className="h-9 w-9 rounded-full border border-stone/20 text-navy-deep hover:bg-cream disabled:opacity-30 disabled:hover:bg-transparent transition"
        >
          →
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-6 sm:gap-8">
        <MonthGrid {...first} today={today} windowEnd={windowEnd} blocked={blocked} start={start} end={end} onPick={onPick} />
        {offset + 1 <= lastOffset && (
          <div className="hidden sm:block">
            <MonthGrid {...second} today={today} windowEnd={windowEnd} blocked={blocked} start={start} end={end} onPick={onPick} />
          </div>
        )}
      </div>

      {message && <p className="mt-3 text-sm text-burnt-orange">{message}</p>}

      <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-stone">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-gold/15 border border-stone/15" />
          Disponible
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-stone/10 border border-stone/15" />
          No disponible
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-gold" />
          Tus fechas
        </span>
      </div>
    </div>
  )
}
