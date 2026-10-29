'use client'

// Selector de fechas tipo Airbnb: un solo calendario donde el huésped toca
// primero el día de llegada y luego el de salida, sin el "Listo"/paloma del
// selector nativo del celular. Al elegir la salida se cierra solo.
//
// Manda su valor con inputs ocultos (checkin / checkout), así que funciona
// dentro de cualquier <form method="get">. Si se envía el formulario sin
// fechas, abre el calendario en vez de enviarlo.
//
// blockedDates (opcional): noches ocupadas (YYYY-MM-DD). No se pueden elegir
// como llegada, y la salida no puede pasar por encima de una noche ocupada
// (el día de salida sí puede ser una noche ocupada: ese día llega otro).
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { todayInMexicoStr } from '@/lib/dates'

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function parse(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return { y, m: m - 1, d }
}
function fmt(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
function addDays(s: string, n: number) {
  const dt = new Date(`${s}T00:00:00Z`)
  dt.setUTCDate(dt.getUTCDate() + n)
  return dt.toISOString().slice(0, 10)
}
function nightsBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000)
}
function label(s: string) {
  const { y, m, d } = parse(s)
  return `${d} ${MONTHS_SHORT[m]} ${y}`
}

export default function DateRangePicker({
  defaultCheckin,
  defaultCheckout,
  blockedDates,
  size = 'md',
}: {
  defaultCheckin?: string
  defaultCheckout?: string
  blockedDates?: string[]
  size?: 'sm' | 'md'
}) {
  const today = todayInMexicoStr()
  const [checkin, setCheckin] = useState(defaultCheckin && defaultCheckin >= today ? defaultCheckin : '')
  const [checkout, setCheckout] = useState(defaultCheckin && defaultCheckout && defaultCheckin >= today ? defaultCheckout : '')
  const [open, setOpen] = useState(false)
  const [hint, setHint] = useState(false)
  const start = parse(checkin || today)
  const [view, setView] = useState({ y: start.y, m: start.m })
  const rootRef = useRef<HTMLDivElement>(null)
  const blocked = useMemo(() => new Set(blockedDates ?? []), [blockedDates])

  // Con la llegada elegida (y sin salida), la salida no puede pasar de la
  // primera noche ocupada después de la llegada.
  const maxCheckout = useMemo(() => {
    if (!checkin || checkout || blocked.size === 0) return null
    for (let i = 0; i < 400; i++) {
      const d = addDays(checkin, i)
      if (blocked.has(d)) return d
    }
    return null
  }, [checkin, checkout, blocked])

  // Si se intenta buscar sin fechas, abrir el calendario en lugar de enviar.
  useEffect(() => {
    const form = rootRef.current?.closest('form')
    if (!form) return
    function onSubmit(e: SubmitEvent) {
      if (!checkin || !checkout) {
        e.preventDefault()
        setHint(true)
        setOpen(true)
      }
    }
    form.addEventListener('submit', onSubmit)
    return () => form.removeEventListener('submit', onSubmit)
  }, [checkin, checkout])

  // Cerrar con Escape y evitar que la página se desplace detrás.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  // "Llegada" empieza de cero; "Salida" conserva la llegada y deja elegir
  // solo la salida.
  function openPicker(fresh: boolean) {
    const base = parse(checkin || today)
    setView({ y: base.y, m: base.m })
    if (fresh) {
      setCheckin('')
      setCheckout('')
    } else if (checkin) {
      setCheckout('')
    }
    setHint(false)
    setOpen(true)
  }

  function pick(day: string) {
    if (!checkin || checkout || day <= checkin) {
      // Primer toque (o reinicio): llegada.
      if (blocked.has(day)) return
      setCheckin(day)
      setCheckout('')
      return
    }
    if (maxCheckout && day > maxCheckout) return
    setCheckout(day)
    setTimeout(() => setOpen(false), 250)
  }

  function shift(delta: number) {
    setView((v) => {
      const m = v.m + delta
      return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }
    })
  }

  const todayP = parse(today)
  const canGoBack = view.y > todayP.y || (view.y === todayP.y && view.m > todayP.m)
  const nights = checkin && checkout ? nightsBetween(checkin, checkout) : 0

  const field =
    size === 'sm'
      ? 'w-full rounded-lg border border-stone/25 bg-white px-2.5 py-1.5 text-left text-xs'
      : 'w-full rounded-xl border border-stone/25 bg-white px-3 py-2.5 text-left text-sm'
  const cap = size === 'sm' ? 'block text-[10px] font-medium text-stone mb-0.5' : 'block text-xs font-medium text-stone mb-1'

  function renderMonth(y: number, m: number) {
    const first = new Date(Date.UTC(y, m, 1)).getUTCDay() // 0 = domingo
    const offset = (first + 6) % 7 // semana empieza en lunes
    const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
    const cells: (string | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => fmt(y, m, i + 1))]
    return (
      <div className="w-full">
        <p className="mb-2 text-center text-sm font-semibold capitalize text-navy-deep">
          {MONTHS[m]} {y}
        </p>
        <div className="grid grid-cols-7 text-center text-[11px] text-stone mb-1">
          {WEEKDAYS.map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((d, i) => {
            if (!d) return <span key={i} />
            const past = d < today
            const choosingCheckout = Boolean(checkin && !checkout)
            const disabled =
              past ||
              (choosingCheckout
                ? d > checkin && maxCheckout != null && d > maxCheckout
                : blocked.has(d))
            const isStart = d === checkin
            const isEnd = d === checkout
            const inRange = checkin && checkout && d > checkin && d < checkout
            const isBlocked = blocked.has(d) && !past
            return (
              <button
                key={d}
                type="button"
                disabled={disabled}
                onClick={() => pick(d)}
                className={[
                  'relative h-10 text-sm transition',
                  inRange ? 'bg-gold/15' : '',
                  isStart && checkout ? 'rounded-l-full bg-gold/15' : '',
                  isEnd ? 'rounded-r-full bg-gold/15' : '',
                  disabled ? 'cursor-not-allowed text-stone/35' : 'text-navy-deep',
                  isBlocked && disabled ? 'line-through' : '',
                ].join(' ')}
              >
                <span
                  className={[
                    'mx-auto flex h-10 w-10 items-center justify-center rounded-full',
                    isStart || isEnd ? 'bg-navy-deep font-semibold text-cream' : '',
                    !disabled && !isStart && !isEnd ? 'hover:ring-1 hover:ring-navy-deep/40' : '',
                  ].join(' ')}
                >
                  {parse(d).d}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const next = { y: view.m === 11 ? view.y + 1 : view.y, m: (view.m + 1) % 12 }

  return (
    <div ref={rootRef} className="grid w-full grid-cols-2 gap-2">
      <input type="hidden" name="checkin" value={checkin} />
      <input type="hidden" name="checkout" value={checkout} />
      <div className="min-w-0">
        <span className={cap}>Llegada</span>
        <button type="button" onClick={() => openPicker(true)} className={`${field} ${checkin ? 'text-navy-deep' : 'text-stone/70'} ${hint && !checkin ? 'ring-2 ring-burnt-orange/60' : ''} truncate focus:outline-none focus:ring-2 focus:ring-gold/50`}>
          {checkin ? label(checkin) : 'Elegir fecha'}
        </button>
      </div>
      <div className="min-w-0">
        <span className={cap}>Salida</span>
        <button
          type="button"
          onClick={() => openPicker(false)}
          className={`${field} ${checkout ? 'text-navy-deep' : 'text-stone/70'} ${hint && !checkout ? 'ring-2 ring-burnt-orange/60' : ''} truncate focus:outline-none focus:ring-2 focus:ring-gold/50`}
        >
          {checkout ? label(checkout) : 'Elegir fecha'}
        </button>
      </div>

      {/* En portal: la barra de arriba usa backdrop-blur, que encerraría el
          calendario dentro de la barra si se dibujara ahí. */}
      {open && createPortal(
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-navy-deep/40 sm:items-center" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label="Elegir fechas"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-xl text-navy-deep">
                  {!checkin ? 'Elige tu llegada' : !checkout ? 'Ahora elige tu salida' : `${nights} ${nights === 1 ? 'noche' : 'noches'}`}
                </p>
                <p className="text-xs text-stone mt-0.5">
                  {checkin ? `${label(checkin)} → ${checkout ? label(checkout) : '…'}` : 'Toca el día que llegas y luego el día que te vas.'}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="rounded-full p-1.5 text-stone hover:bg-cream">
                ✕
              </button>
            </div>

            <div className="relative z-10 flex items-center justify-between mb-1">
              <button type="button" onClick={() => shift(-1)} disabled={!canGoBack} aria-label="Mes anterior" className="rounded-full px-3 py-1 text-lg text-navy-deep hover:bg-cream disabled:opacity-25">
                ‹
              </button>
              <button type="button" onClick={() => shift(1)} aria-label="Mes siguiente" className="rounded-full px-3 py-1 text-lg text-navy-deep hover:bg-cream">
                ›
              </button>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 -mt-8">
              {renderMonth(view.y, view.m)}
              <div className="hidden sm:block">
                {renderMonth(next.y, next.m)}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-stone/10 pt-3">
              <button
                type="button"
                onClick={() => {
                  setCheckin('')
                  setCheckout('')
                }}
                className="text-sm text-stone underline underline-offset-2"
              >
                Borrar fechas
              </button>
              {blocked.size > 0 && <span className="text-[11px] text-stone">Los días tachados están ocupados</span>}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
