'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { staffSetBlock, staffMoveStay, staffUpdateStayPayment } from './actions'
import StayTools, { type StayActions } from './StayTools'
import type { GuestInput } from '@/lib/manual-stays'

const CHANNELS = ['WhatsApp / directo', 'Airbnb', 'Booking', 'Recomendación', 'Otro']

// Cuántos meses se muestran a la vez (todo el horizonte cargado: ~13 meses).
const MONTHS_SHOWN = 13

// tag: texto corto que se ve dentro del día (quién bloqueó o "Reserva"); solo
// en reservas y bloqueos manuales. label: el detalle completo al tocar el día.
// details: renglones extra (datos del huésped de una reserva por fuera);
// phone: para el botón de WhatsApp.
export type DayInfo = {
  kind: 'manual' | 'booking' | 'external'
  label: string
  tag?: string
  details?: string[]
  phone?: string | null
  // Reserva por fuera que se puede editar (pago) o mover de cabaña.
  stay?: { id: string; paid: number | null; balance: number | null }
}

type SetBlock = (
  propertyId: string,
  dates: string[],
  blocked: boolean,
  note?: string | null,
  guest?: GuestInput | null
) => Promise<{ error: string | null }>

function waHref(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits.length === 10 ? `52${digits}` : digits}`
}

const fieldCls =
  'w-full rounded-lg border border-stone/25 bg-white px-3 py-2 text-sm text-navy-deep focus:border-gold focus:outline-none'

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
  booking: 'bg-navy text-cream border-navy',
  external: 'bg-burnt-orange/20 text-burnt-orange border-burnt-orange/30 cursor-not-allowed',
}

export default function StaffCalendar({
  propertyId,
  today,
  days,
  canBlock,
  setBlock = staffSetBlock,
  stayActions = { updatePayment: staffUpdateStayPayment, move: staffMoveStay },
  moveTargets = [],
}: {
  propertyId: string
  today: string
  days: Record<string, DayInfo>
  canBlock: boolean
  // Acción que bloquea/libera días. Por defecto la del panel de colaboradores;
  // el panel de socios (/socios) pasa la suya.
  setBlock?: SetBlock
  stayActions?: StayActions
  // Otras cabañas a las que se puede mover una reserva por fuera.
  moveTargets?: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')
  // Datos del huésped (opcional): para bloqueos que son una reserva por fuera.
  const [withGuest, setWithGuest] = useState(false)
  const [guest, setGuest] = useState({ guest_name: '', guest_phone: '', guests: '', amount_mxn: '', paid_mxn: '', balance_mxn: '', channel: CHANNELS[0], notes: '' })
  const [message, setMessage] = useState<string | null>(null)
  // Último día ocupado que se tocó, para mostrar quién/qué lo bloqueó.
  const [focused, setFocused] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const months = useMemo(() => Array.from({ length: MONTHS_SHOWN }, (_, i) => monthStart(today, i)), [today])

  const selectedList = [...selected].sort()
  const selectedFree = selectedList.filter((d) => !days[d])
  const selectedManual = selectedList.filter((d) => days[d]?.kind === 'manual')

  function toggle(date: string) {
    const info = days[date]
    setFocused(info && info.kind !== 'external' ? date : null)
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
    if (blocked && withGuest && !guest.guest_name.trim()) {
      setMessage('Escribe al menos el nombre del huésped (o quita la opción de reserva).')
      return
    }
    const guestData: GuestInput | null =
      blocked && withGuest
        ? {
            guest_name: guest.guest_name,
            guest_phone: guest.guest_phone,
            guests: guest.guests ? Number(guest.guests) : null,
            amount_mxn: guest.amount_mxn ? Number(guest.amount_mxn) : null,
            paid_mxn: guest.paid_mxn !== '' ? Number(guest.paid_mxn) : null,
            balance_mxn: guest.balance_mxn !== '' ? Number(guest.balance_mxn) : null,
            channel: guest.channel,
            notes: guest.notes,
          }
        : null
    startTransition(async () => {
      const r = await setBlock(propertyId, dates, blocked, note, guestData)
      if (r.error) {
        setMessage(r.error)
        return
      }
      setMessage(blocked ? `Listo: ${dates.length} día(s) bloqueado(s).` : `Listo: ${dates.length} día(s) liberado(s).`)
      setSelected(new Set())
      setNote('')
      setWithGuest(false)
      setGuest({ guest_name: '', guest_phone: '', guests: '', amount_mxn: '', paid_mxn: '', balance_mxn: '', channel: CHANNELS[0], notes: '' })
      router.refresh()
    })
  }

  return (
    <div className="rounded-2xl border border-stone/15 bg-white p-4 sm:p-5">
      <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
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
                    <span className="block leading-none">{Number(d.slice(8))}</span>
                    {!past && info?.tag && (
                      <span className="mt-0.5 block truncate px-0.5 text-[8px] leading-tight opacity-80 sm:text-[9px]">
                        {info.tag}
                      </span>
                    )}
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
        <div className="sticky bottom-3 z-10 mt-4 rounded-xl border border-gold/40 bg-cream p-3 space-y-3 shadow-lg">
          <p className="text-sm text-navy-deep">
            {selected.size} día(s) seleccionado(s)
            {selectedManual.length > 0 && selectedFree.length > 0
              ? ` (${selectedFree.length} libres, ${selectedManual.length} ya bloqueados)`
              : ''}
          </p>
          {selectedFree.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-navy-deep">
              <input
                type="checkbox"
                checked={withGuest}
                onChange={(e) => setWithGuest(e.target.checked)}
                className="h-4 w-4 accent-[#c9a227]"
              />
              Es una reserva: agregar datos del huésped
            </label>
          )}
          {selectedFree.length > 0 && withGuest && (
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
              <input
                value={guest.paid_mxn}
                onChange={(e) => setGuest({ ...guest, paid_mxn: e.target.value.replace(/[^\d.]/g, '') })}
                placeholder="¿Cuánto ya pagó? (MXN)"
                inputMode="decimal"
                className={fieldCls}
              />
              <input
                value={guest.balance_mxn}
                onChange={(e) => setGuest({ ...guest, balance_mxn: e.target.value.replace(/[^\d.]/g, '') })}
                placeholder="¿Cuánto debe? (0 = ya pagó todo)"
                inputMode="decimal"
                className={fieldCls}
              />
              <select
                value={guest.channel}
                onChange={(e) => setGuest({ ...guest, channel: e.target.value })}
                className={fieldCls}
              >
                {CHANNELS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <input
                value={guest.notes}
                onChange={(e) => setGuest({ ...guest, notes: e.target.value })}
                placeholder="Notas (hora de llegada, mascota, anticipo…)"
                maxLength={500}
                className={fieldCls}
              />
              <p className="sm:col-span-2 text-[11px] text-stone">
                Estos datos solo los ven tú, tu equipo y el anfitrión. No se mandan a Airbnb ni se ven en el sitio.
              </p>
            </div>
          )}
          {selectedFree.length > 0 && (
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nota para el anfitrión (ej. mantenimiento, uso personal, llega familia)"
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
      {focused && days[focused] && (
        <div className="mt-3 rounded-lg bg-cream px-3 py-2 text-sm text-navy-deep">
          <span className="font-medium capitalize">
            {new Date(`${focused}T12:00:00Z`).toLocaleDateString('es-MX', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              timeZone: 'UTC',
            })}
            :
          </span>{' '}
          {days[focused].label}
          {days[focused].details && (
            <span className="mt-1.5 block space-y-0.5 text-stone">
              {days[focused].details!.map((line, i) => (
                <span key={i} className="block">
                  {line}
                </span>
              ))}
            </span>
          )}
          {days[focused].phone && (
            <a
              href={waHref(days[focused].phone!)}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block rounded-full bg-[#25D366] px-3 py-1 text-xs font-medium text-white"
            >
              Escribir por WhatsApp
            </a>
          )}
          {canBlock && days[focused].stay && (
            <StayTools key={days[focused].stay!.id} stay={days[focused].stay!} targets={moveTargets} actions={stayActions} />
          )}
        </div>
      )}
      {message && <p className="mt-3 text-sm text-stone">{message}</p>}
    </div>
  )
}
