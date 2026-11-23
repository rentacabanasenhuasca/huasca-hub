'use client'

// Calendario en forma de lista: una fila por propiedad y una columna por día,
// como el calendario del anfitrión. Se usa en /equipo y /socios cuando la
// persona tiene más de una propiedad. Mismas reglas que StaffCalendar: solo
// se bloquean días libres y solo se liberan bloqueos hechos a mano.
import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { DayInfo } from './StaffCalendar'
import type { GuestInput } from '@/lib/manual-stays'

type SetBlock = (
  propertyId: string,
  dates: string[],
  blocked: boolean,
  note?: string | null,
  guest?: GuestInput | null
) => Promise<{ error: string | null }>

type Property = { id: string; name: string; photo?: string | null; href?: string }

const WINDOW = 21 // días visibles
const STEP = 14
const HORIZON = 400

const CHANNELS = ['WhatsApp / directo', 'Airbnb', 'Booking', 'Recomendación', 'Otro']
const WEEKDAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

const CELL: Record<'free' | DayInfo['kind'], string> = {
  free: 'bg-white text-navy-deep border-stone/15 hover:border-gold',
  manual: 'bg-stone/25 text-navy-deep border-stone/30 hover:border-gold',
  booking: 'bg-navy text-cream border-navy',
  external: 'bg-burnt-orange/20 text-burnt-orange border-burnt-orange/30',
}

const fieldCls =
  'w-full rounded-lg border border-stone/25 bg-white px-3 py-2 text-sm text-navy-deep focus:border-gold focus:outline-none'

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function waHref(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits.length === 10 ? `52${digits}` : digits}`
}

function longDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

const key = (propertyId: string, date: string) => `${propertyId}|${date}`
const EMPTY_GUEST = { guest_name: '', guest_phone: '', guests: '', amount_mxn: '', channel: CHANNELS[0], notes: '' }

export default function MultiCalendar({
  properties,
  today,
  days,
  canBlock,
  setBlock,
}: {
  properties: Property[]
  today: string
  days: Record<string, Record<string, DayInfo>>
  canBlock: boolean
  setBlock: SetBlock
}) {
  const router = useRouter()
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [focused, setFocused] = useState<{ propertyId: string; date: string } | null>(null)
  const [note, setNote] = useState('')
  const [withGuest, setWithGuest] = useState(false)
  const [guest, setGuest] = useState(EMPTY_GUEST)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const dates = useMemo(() => Array.from({ length: WINDOW }, (_, i) => addDays(today, offset + i)), [today, offset])
  const monthLabel = useMemo(() => {
    const fmt = (d: string) =>
      new Date(`${d}T12:00:00Z`).toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    const a = fmt(dates[0])
    const b = fmt(dates[dates.length - 1])
    return a === b ? a : `${a} – ${b}`
  }, [dates])

  // Lo seleccionado, por propiedad: días libres (para bloquear) y bloqueos a mano (para liberar).
  const byProperty = useMemo(() => {
    const map = new Map<string, { free: string[]; manual: string[] }>()
    for (const k of selected) {
      const [pid, date] = k.split('|')
      const entry = map.get(pid) ?? { free: [], manual: [] }
      const info = days[pid]?.[date]
      if (!info) entry.free.push(date)
      else if (info.kind === 'manual') entry.manual.push(date)
      map.set(pid, entry)
    }
    return map
  }, [selected, days])
  const freeCount = [...byProperty.values()].reduce((n, e) => n + e.free.length, 0)
  const manualCount = [...byProperty.values()].reduce((n, e) => n + e.manual.length, 0)
  const freeProps = [...byProperty.entries()].filter(([, e]) => e.free.length > 0)
  const singleProperty = freeProps.length === 1

  function toggle(propertyId: string, date: string) {
    const info = days[propertyId]?.[date]
    setFocused(info ? { propertyId, date } : null)
    if (!canBlock || (info && info.kind !== 'manual')) return
    setMessage(null)
    setSelected((prev) => {
      const next = new Set(prev)
      const k = key(propertyId, date)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  function apply(blocked: boolean) {
    if (blocked && withGuest && !guest.guest_name.trim()) {
      setMessage('Escribe al menos el nombre del huésped (o quita la opción de reserva).')
      return
    }
    const guestData: GuestInput | null =
      blocked && withGuest && singleProperty
        ? {
            guest_name: guest.guest_name,
            guest_phone: guest.guest_phone,
            guests: guest.guests ? Number(guest.guests) : null,
            amount_mxn: guest.amount_mxn ? Number(guest.amount_mxn) : null,
            channel: guest.channel,
            notes: guest.notes,
          }
        : null
    startTransition(async () => {
      const errors: string[] = []
      let total = 0
      for (const [pid, entry] of byProperty) {
        const list = blocked ? entry.free : entry.manual
        if (list.length === 0) continue
        const r = await setBlock(pid, list, blocked, note, guestData)
        if (r.error) errors.push(`${properties.find((p) => p.id === pid)?.name ?? 'Cabaña'}: ${r.error}`)
        else total += list.length
      }
      setMessage(
        errors.length
          ? errors.join(' · ')
          : blocked
            ? `Listo: ${total} día(s) bloqueado(s).`
            : `Listo: ${total} día(s) liberado(s).`
      )
      if (errors.length === 0) {
        setSelected(new Set())
        setNote('')
        setWithGuest(false)
        setGuest(EMPTY_GUEST)
      }
      router.refresh()
    })
  }

  const focusedInfo = focused ? days[focused.propertyId]?.[focused.date] : undefined
  const focusedName = focused ? properties.find((p) => p.id === focused.propertyId)?.name : ''

  return (
    <div className="rounded-2xl border border-stone/15 bg-white p-3 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOffset((o) => Math.max(0, o - STEP))}
          disabled={offset === 0}
          className="rounded-full border border-stone/25 px-4 py-2 text-sm text-navy-deep hover:border-gold disabled:opacity-40"
        >
          ← Anterior
        </button>
        <p className="text-sm font-medium capitalize text-navy-deep">{monthLabel}</p>
        <div className="flex gap-2">
          {offset > 0 && (
            <button
              type="button"
              onClick={() => setOffset(0)}
              className="rounded-full px-3 py-2 text-sm text-stone hover:text-navy-deep"
            >
              Hoy
            </button>
          )}
          <button
            type="button"
            onClick={() => setOffset((o) => Math.min(HORIZON - WINDOW, o + STEP))}
            disabled={offset >= HORIZON - WINDOW}
            className="rounded-full border border-stone/25 px-4 py-2 text-sm text-navy-deep hover:border-gold disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white" />
              {dates.map((d) => {
                const dow = new Date(`${d}T12:00:00Z`).getUTCDay()
                const weekend = dow === 0 || dow === 5 || dow === 6
                return (
                  <th key={d} className={`w-12 text-center text-[11px] font-medium ${weekend ? 'text-burnt-orange' : 'text-stone'}`}>
                    <span className="block">{WEEKDAYS[dow]}</span>
                    <span className="block text-sm text-navy-deep">{Number(d.slice(8))}</span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {properties.map((p) => (
              <tr key={p.id}>
                <th scope="row" className="sticky left-0 z-10 bg-white pr-2 text-left align-middle">
                  <span className="flex w-32 items-center gap-2 sm:w-44">
                    {p.photo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photo} alt="" className="hidden h-9 w-9 shrink-0 rounded-lg object-cover sm:block" />
                    )}
                    {p.href ? (
                      <Link href={p.href} className="text-xs font-medium leading-tight text-navy-deep hover:text-gold sm:text-sm">
                        {p.name}
                      </Link>
                    ) : (
                      <span className="text-xs font-medium leading-tight text-navy-deep sm:text-sm">{p.name}</span>
                    )}
                  </span>
                </th>
                {dates.map((d) => {
                  const info = days[p.id]?.[d]
                  const isSel = selected.has(key(p.id, d))
                  return (
                    <td key={d} className="p-0">
                      <button
                        type="button"
                        title={info?.label ?? 'Libre'}
                        aria-label={`${p.name}, ${longDate(d)}: ${info?.label ?? 'libre'}`}
                        onClick={() => toggle(p.id, d)}
                        className={`flex h-12 w-12 flex-col items-center justify-center rounded-lg border px-0.5 transition ${CELL[info?.kind ?? 'free']} ${
                          isSel ? 'ring-2 ring-gold ring-offset-1' : ''
                        }`}
                      >
                        {info?.tag ? (
                          <span className="block w-full truncate text-center text-[9px] leading-tight">{info.tag}</span>
                        ) : (
                          <span className="block text-[10px] text-stone/60">·</span>
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded border border-stone/30 bg-white" /> Libre
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-stone/25" /> Bloqueado a mano / reserva por fuera
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-navy" /> Reservado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-burnt-orange/20" /> Airbnb / otra plataforma
        </span>
      </div>

      {canBlock && selected.size > 0 && (
        <div className="sticky bottom-3 z-20 mt-4 space-y-3 rounded-xl border border-gold/40 bg-cream p-3 shadow-lg">
          <p className="text-sm text-navy-deep">
            {selected.size} día(s) seleccionado(s)
            {byProperty.size > 1 ? ` en ${byProperty.size} cabañas` : ''}
            {freeCount > 0 && manualCount > 0 ? ` (${freeCount} libres, ${manualCount} ya bloqueados)` : ''}
          </p>
          {freeCount > 0 &&
            (singleProperty ? (
              <label className="flex items-center gap-2 text-sm text-navy-deep">
                <input
                  type="checkbox"
                  checked={withGuest}
                  onChange={(e) => setWithGuest(e.target.checked)}
                  className="h-4 w-4 accent-[#c9a227]"
                />
                Es una reserva: agregar datos del huésped
              </label>
            ) : (
              <p className="text-xs text-stone">Para anotar los datos de un huésped, selecciona días de una sola cabaña.</p>
            ))}
          {freeCount > 0 && withGuest && singleProperty && (
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={guest.guest_name}
                onChange={(e) => setGuest({ ...guest, guest_name: e.target.value })}
                placeholder="Nombre del huésped *"
                maxLength={120}
                className={fieldCls}
              />
              <input
                value={guest.guest_phone}
                onChange={(e) => setGuest({ ...guest, guest_phone: e.target.value })}
                placeholder="WhatsApp (10 dígitos)"
                inputMode="tel"
                className={fieldCls}
              />
              <input
                value={guest.guests}
                onChange={(e) => setGuest({ ...guest, guests: e.target.value.replace(/\D/g, '') })}
                placeholder="¿Cuántas personas?"
                inputMode="numeric"
                className={fieldCls}
              />
              <select value={guest.channel} onChange={(e) => setGuest({ ...guest, channel: e.target.value })} className={fieldCls}>
                {CHANNELS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <input
                value={guest.notes}
                onChange={(e) => setGuest({ ...guest, notes: e.target.value })}
                placeholder="Notas y extras (cena, decoración, hora de llegada…)"
                maxLength={500}
                className={fieldCls}
              />
              <p className="text-[11px] text-stone sm:col-span-2">
                Estos datos solo los ven tú, tu equipo y el anfitrión. No se mandan a Airbnb ni se ven en el sitio.
              </p>
            </div>
          )}
          {freeCount > 0 && (
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nota para el anfitrión (ej. mantenimiento, uso personal)"
              maxLength={120}
              className={fieldCls}
            />
          )}
          <div className="flex flex-wrap gap-2">
            {freeCount > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={() => apply(true)}
                className="rounded-full bg-navy-deep px-4 py-2 text-sm font-medium text-cream transition hover:bg-navy disabled:opacity-50"
              >
                Bloquear {freeCount} día(s)
              </button>
            )}
            {manualCount > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={() => apply(false)}
                className="rounded-full border border-navy-deep px-4 py-2 text-sm font-medium text-navy-deep transition hover:bg-white disabled:opacity-50"
              >
                Desbloquear {manualCount} día(s)
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

      {focused && focusedInfo && (
        <div className="mt-3 rounded-lg bg-cream px-3 py-2 text-sm text-navy-deep">
          <span className="font-medium">{focusedName}</span> ·{' '}
          <span className="capitalize">{longDate(focused.date)}</span>: {focusedInfo.label}
          {focusedInfo.details && (
            <span className="mt-1.5 block space-y-0.5 text-stone">
              {focusedInfo.details.map((line, i) => (
                <span key={i} className="block">
                  {line}
                </span>
              ))}
            </span>
          )}
          {focusedInfo.phone && (
            <a
              href={waHref(focusedInfo.phone)}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block rounded-full bg-[#25D366] px-3 py-1 text-xs font-medium text-white"
            >
              Escribir por WhatsApp
            </a>
          )}
        </div>
      )}
      {message && <p className="mt-3 text-sm text-stone">{message}</p>}
    </div>
  )
}
