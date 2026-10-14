'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { staffSetBlock } from './actions'

export type DayInfo = { kind: 'manual' | 'booking' | 'external'; label: string }

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

function monthStart(date: string, offset: number) {
  const [y, m] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + offset, 1))
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10)
}

function monthDays(start: Date) {
  const days: (string | null)[] = []
  const lead = (start.getUTCDay() + 6) % 7 // lunes = 0
  for (let i = 0; i < lead; i++) days.push(null)
  const d = new Date(start)
  while (d.getUTCMonth() === start.getUTCMonth()) {
    days.push(iso(d))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return days
}

const STYLE: Record<'free' | DayInfo['kind'], string> = {
  free: 'bg-white text-navy-deep border-stone/15 hover:border-gold',
  manual: 'bg-stone/25 text-navy-deep border-stone/30 hover:border-gold',
  booking: 'bg-navy text-cream border-navy cursor-not-allowed',
  external: 'bg-burnt-orange/20 text-burnt-orange border-burnt-orange/30 cursor-not-allowed',
}

export default function StaffCalendar({
  propertyId,
  today,
  days,
  canBlock,
}: {
  propertyId: string
  today: string
  days: Record<string, DayInfo>
  canBlock: boolean
}) {
  const router = useRouter()
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const months = useMemo(() => [monthStart(today, offset), monthStart(today, offset + 1)], [today, offset])

  const selectedList = [...selected].sort()
  const selectedFree = selectedList.filter((d) => !days[d])
  const selectedManual = selectedList.filter((d) => days[d]?.kind === 'manual')

  function toggle(date: string) {
    const info = days[date]
    if (!canBlock || date < today || (info && info.kind !== 'manual')) return
    setMessage(null)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  function apply(blocked: boolean) {
    const dates = blocked ? selectedFree : selectedManual
    if (dates.length === 0) return
    startTransition(async () => {
      const r = await staffSetBlock(propertyId, dates, blocked, note)
      if (r.error) {
        setMessage(r.error)
        return
      }
      setMessage(blocked ? `Listo: ${dates.length} día(s) bloqueado(s).` : `Listo: ${dates.length} día(s) liberado(s).`)
      setSelected(new Set())
      setNote('')
      router.refresh()
    })
  }

  return (
    <div className="rounded-2xl border border-stone/15 bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setOffset((o) => Math.max(0, o - 1))}
          disabled={offset === 0}
          className="rounded-full border border-stone/25 px-3 py-1 text-sm text-navy-deep disabled:opacity-30"
          aria-label="Mes anterior"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => setOffset((o) => Math.min(11, o + 1))}
          disabled={offset >= 11}
          className="rounded-full border border-stone/25 px-3 py-1 text-sm text-navy-deep disabled:opacity-30"
          aria-label="Mes siguiente"
        >
          →
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {months.map((m) => (
          <div key={iso(m)}>
            <p className="text-center font-medium text-navy-deep capitalize mb-2">
              {m.toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
            </p>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-stone mb-1">
              {WEEKDAYS.map((w, i) => (
                <span key={i}>{w}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthDays(m).map((d, i) => {
                if (!d) return <span key={`e${i}`} />
                const info = days[d]
                const past = d < today
                const isSel = selected.has(d)
                return (
                  <button
                    key={d}
                    type="button"
                    title={info?.label ?? 'Libre'}
                    onClick={() => toggle(d)}
                    disabled={past}
                    className={`aspect-square rounded-lg border text-sm transition ${
                      past ? 'bg-white text-stone/40 border-transparent' : STYLE[info?.kind ?? 'free']
                    } ${isSel ? 'ring-2 ring-gold ring-offset-1' : ''}`}
                  >
                    {Number(d.slice(8))}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-stone/30 bg-white" /> Libre
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-stone/25" /> Bloqueado a mano
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-navy" /> Reservado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-burnt-orange/20" /> Airbnb / otra plataforma
        </span>
      </div>

      {canBlock && selected.size > 0 && (
        <div className="mt-4 rounded-xl bg-cream p-3 space-y-3">
          <p className="text-sm text-navy-deep">
            {selected.size} día(s) seleccionado(s)
            {selectedManual.length > 0 && selectedFree.length > 0
              ? ` (${selectedFree.length} libres, ${selectedManual.length} ya bloqueados)`
              : ''}
          </p>
          {selectedFree.length > 0 && (
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nota opcional (ej. mantenimiento, uso personal)"
              maxLength={120}
              className="w-full rounded-lg border border-stone/25 bg-white px-3 py-2 text-sm text-navy-deep focus:border-gold focus:outline-none"
            />
          )}
          <div className="flex flex-wrap gap-2">
            {selectedFree.length > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={() => apply(true)}
                className="rounded-full bg-navy-deep px-4 py-2 text-sm font-medium text-cream hover:bg-navy transition disabled:opacity-50"
              >
                Bloquear {selectedFree.length} día(s)
              </button>
            )}
            {selectedManual.length > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={() => apply(false)}
                className="rounded-full border border-navy-deep px-4 py-2 text-sm font-medium text-navy-deep hover:bg-white transition disabled:opacity-50"
              >
                Desbloquear {selectedManual.length} día(s)
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-full px-3 py-2 text-sm text-stone hover:text-navy-deep"
            >
              Limpiar
            </button>
          </div>
        </div>
      )}
      {message && <p className="mt-3 text-sm text-stone">{message}</p>}
    </div>
  )
}
