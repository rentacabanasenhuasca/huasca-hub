'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  applyRuleToSelection,
  removeApplication,
  loadCalendarWindow,
  setManualBlock,
  setMinNightsOverride,
  getBookingDetails,
  cancelBooking,
  moveBooking,
  type Selection,
} from './actions'
import ManualBookingModal from './ManualBookingModal'

type Property = {
  id: string
  name: string
  weekday_price_mxn: number
  weekend_price_mxn: number
  min_nights: number
  cover_photo_url: string | null
}
type Rule = { id: string; name: string; color: string | null; priority: number }
type CalendarDay = {
  property_id: string
  date: string
  price_mxn: number
  min_nights: number
  applied_rule_id: string | null
}
type Application = {
  id: string
  property_id: string
  start_date: string
  end_date: string
  rule_id: string
  pricing_rules: { name: string; color: string | null } | null
}
type BlockedDate = {
  property_id: string
  date: string
  source: string
  note: string | null
  booking_id: string | null
  external_summary: string | null
  ical_sources: { platform: string; label: string } | { platform: string; label: string }[] | null
}
type BookingDetails = {
  id: string
  guest_name: string
  guest_email: string | null
  guest_phone: string | null
  guest_notes: string | null
  check_in: string
  check_out: string
  adults: number
  children: number
  infants: number
  pets: boolean
  status: string
  total_price_mxn: number
  payment_provider: string | null
  created_at: string
  property_name: string
}

// Colores para distinguir de dónde viene cada bloqueo, igual que se ve en
// Airbnb/Booking: cada plataforma con su propio color, y las reservas
// directas (pagadas en este sitio) con el color de marca.
const SOURCE_COLOR: Record<string, string> = {
  airbnb: '#ec4899', // rosa
  booking: '#3b82f6', // azul
  direct: '#3f7a3a', // verde bosque vivo de marca (más visible que el olivo oscuro) — reservas hechas en este sitio
}

function icalSourceOf(b: BlockedDate): { platform: string; label: string } | null {
  const rel = b.ical_sources
  if (!rel) return null
  return Array.isArray(rel) ? (rel[0] ?? null) : rel
}

function platformOf(b: BlockedDate): string | null {
  return icalSourceOf(b)?.platform ?? null
}

function blockedKind(b: BlockedDate): 'airbnb' | 'booking' | 'ical-otro' | 'direct' | 'manual' {
  if (b.source === 'booking') return 'direct'
  if (b.source === 'manual') return 'manual'
  const platform = platformOf(b)
  if (platform === 'airbnb') return 'airbnb'
  if (platform === 'booking') return 'booking'
  return 'ical-otro'
}

function solidColorFor(kind: ReturnType<typeof blockedKind>): string {
  return SOURCE_COLOR[kind] ?? '#8b8b8b'
}

const WEEKDAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// Ancho fijo de cada columna de día, para poder calcular offsets de scroll.
const DAY_COL_WIDTH = 52
const PROPERTY_COL_WIDTH = 200
// Cuánto se extiende la ventana cargada cada vez que te acercas a un borde.
const LOAD_CHUNK_DAYS = 62
// Qué tan cerca del borde (en px) dispara la carga de más días.
const LOAD_THRESHOLD_PX = 700

function key(propertyId: string, date: string) {
  return `${propertyId}|${date}`
}

function parseDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00Z`)
}

function toDateOnly(d: Date) {
  return d.toISOString().slice(0, 10)
}

function addDaysStr(dateStr: string, delta: number) {
  const d = parseDate(dateStr)
  d.setUTCDate(d.getUTCDate() + delta)
  return toDateOnly(d)
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

function daysBetween(from: string, to: string) {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86400000)
}

export default function CalendarGrid({
  year,
  month,
  windowStart,
  windowEnd,
  properties,
  rules,
  calendarDays,
  applications,
  blockedDates,
}: {
  year: number
  month: number
  windowStart: string
  windowEnd: string
  properties: Property[]
  rules: Rule[]
  calendarDays: CalendarDay[]
  applications: Application[]
  blockedDates: BlockedDate[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dragMode, setDragMode] = useState<'add' | 'remove' | null>(null)
  const [selectedRuleId, setSelectedRuleId] = useState<string>(rules[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [minNightsInput, setMinNightsInput] = useState('')
  const [blockNoteInput, setBlockNoteInput] = useState('')

  const [showManualBooking, setShowManualBooking] = useState(false)

  const [showQuickApply, setShowQuickApply] = useState(false)
  const [quickRuleId, setQuickRuleId] = useState<string>(rules[0]?.id ?? '')
  const [quickProperties, setQuickProperties] = useState<Set<string>>(new Set())
  const [quickStart, setQuickStart] = useState('')
  const [quickEnd, setQuickEnd] = useState('')
  const [quickError, setQuickError] = useState<string | null>(null)

  // Ventana de fechas cargada en el cliente y sus datos. Empieza con lo que
  // mandó el servidor y va creciendo con el scroll infinito.
  const [loadedStart, setLoadedStart] = useState(windowStart)
  const [loadedEnd, setLoadedEnd] = useState(windowEnd)
  const [calendarDaysState, setCalendarDaysState] = useState(calendarDays)
  const [blockedDatesState, setBlockedDatesState] = useState(blockedDates)
  const [loadingMore, setLoadingMore] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const pendingPrependWidthRef = useRef<number | null>(null)
  const loadingMoreRef = useRef(false)
  const propertyIds = useMemo(() => properties.map((p) => p.id), [properties])

  // Nota: cuando el servidor manda una ventana nueva (navegación por "Hoy" o
  // por el selector de mes/año), page.tsx le da a este componente una
  // `key` distinta, así que React lo vuelve a montar desde cero con el
  // estado inicial correcto en vez de tener que resincronizarlo aquí.

  const days = useMemo(() => eachDateInRange(loadedStart, loadedEnd), [loadedStart, loadedEnd])

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

  const dayMap = useMemo(() => {
    const m = new Map<string, CalendarDay>()
    for (const cd of calendarDaysState) m.set(key(cd.property_id, cd.date), cd)
    return m
  }, [calendarDaysState])

  const blockedMap = useMemo(() => {
    const m = new Map<string, BlockedDate>()
    for (const b of blockedDatesState) m.set(key(b.property_id, b.date), b)
    return m
  }, [blockedDatesState])

  const [detailsFor, setDetailsFor] = useState<{ propertyId: string; date: string } | null>(null)
  // Se capturan al abrir el panel (en vez de recalcularse en cada render
  // desde blockedDatesState) porque cancelar o mover la reserva borra su
  // fila de blocked_dates — si siguiéramos leyendo el mapa en vivo, el
  // panel perdería de vista qué estaba mostrando justo cuando la acción
  // termina con éxito.
  const [detailsKind, setDetailsKind] = useState<ReturnType<typeof blockedKind> | null>(null)
  const [detailsBlocked, setDetailsBlocked] = useState<BlockedDate | null>(null)
  const [bookingDetails, setBookingDetails] = useState<BookingDetails | null>(null)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  // Mover/cancelar la reserva que se está viendo en el panel de detalle.
  const [moveTarget, setMoveTarget] = useState('')
  const [movingBooking, setMovingBooking] = useState(false)
  const [cancellingBooking, setCancellingBooking] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [cancelWithRefund, setCancelWithRefund] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  function openDetails(propertyId: string, date: string, blocked: BlockedDate) {
    setDetailsFor({ propertyId, date })
    setDetailsKind(blockedKind(blocked))
    setDetailsBlocked(blocked)
    setBookingDetails(null)
    setDetailsError(null)
    setMoveTarget('')
    setConfirmingCancel(false)
    setCancelWithRefund(false)
    setActionError(null)
    setActionMessage(null)
    if (blocked.booking_id) {
      setLoadingDetails(true)
      startTransition(async () => {
        const res = await getBookingDetails(blocked.booking_id!)
        setLoadingDetails(false)
        if (res.error) setDetailsError(res.error)
        else setBookingDetails(res.booking)
      })
    }
  }

  function closeDetails() {
    setDetailsFor(null)
    setDetailsKind(null)
    setDetailsBlocked(null)
    setBookingDetails(null)
    setDetailsError(null)
    setMoveTarget('')
    setConfirmingCancel(false)
    setCancelWithRefund(false)
    setActionError(null)
    setActionMessage(null)
  }

  function handleMoveBooking() {
    if (!bookingDetails || !moveTarget) return
    setActionError(null)
    setActionMessage(null)
    setMovingBooking(true)
    const bookingId = bookingDetails.id
    startTransition(async () => {
      const res = await moveBooking(bookingId, moveTarget)
      setMovingBooking(false)
      if (res.error) {
        setActionError(res.error)
        return
      }
      // Refleja el movimiento localmente: quita el bloqueo viejo, agrega el
      // nuevo, sin esperar a que se recargue toda la ventana del calendario.
      setBlockedDatesState((prev) => [
        ...prev.filter((b) => b.booking_id !== bookingId),
        ...(res.dates ?? []).map((date) => ({
          property_id: res.newPropertyId!,
          date,
          source: 'booking',
          note: null,
          booking_id: bookingId,
          external_summary: null,
          ical_sources: null,
        })),
      ])
      const newProperty = properties.find((p) => p.id === moveTarget)
      setActionMessage(`Reserva movida a ${newProperty?.name ?? 'la nueva cabaña'}.`)
      setBookingDetails((prev) => (prev ? { ...prev, property_name: newProperty?.name ?? prev.property_name } : prev))
      // El panel ahora "pertenece" a la cabaña destino, para que el header y
      // el selector de mover (que excluye la cabaña actual) queden correctos
      // si se vuelve a mover.
      setDetailsFor((prev) => (prev ? { ...prev, propertyId: res.newPropertyId! } : prev))
      setMoveTarget('')
    })
  }

  function handleCancelBooking() {
    if (!bookingDetails) return
    setActionError(null)
    setActionMessage(null)
    setCancellingBooking(true)
    const bookingId = bookingDetails.id
    const refund = cancelWithRefund
    startTransition(async () => {
      const res = await cancelBooking(bookingId, refund)
      setCancellingBooking(false)
      if (res.error) {
        setActionError(res.error)
        return
      }
      setBlockedDatesState((prev) => prev.filter((b) => b.booking_id !== bookingId))
      setBookingDetails((prev) => (prev ? { ...prev, status: 'cancelled' } : prev))
      setConfirmingCancel(false)
      setActionMessage(res.warning ?? 'Reserva cancelada y fechas liberadas.')
    })
  }

  const ruleColor = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of rules) m.set(r.id, r.color ?? '#c9a24a')
    return m
  }, [rules])

  // Posiciona el scroll para que el mes pedido (year/month) quede al
  // principio de la vista, al montar el componente (page.tsx remonta este
  // componente con una key nueva cada vez que cambia la ventana del
  // servidor).
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const centerStart = toDateOnly(new Date(Date.UTC(year, month - 1, 1)))
    const offset = daysBetween(loadedStart, centerStart) * DAY_COL_WIDTH
    el.scrollLeft = Math.max(0, offset)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Rueda del mouse vertical → desplaza el calendario horizontalmente (el
  // trackpad ya desplaza horizontal de forma nativa con swipe).
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

  async function loadMore(direction: 'before' | 'after') {
    if (loadingMoreRef.current || propertyIds.length === 0) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      if (direction === 'after') {
        const newStart = addDaysStr(loadedEnd, 1)
        const newEnd = addDaysStr(loadedEnd, LOAD_CHUNK_DAYS)
        const res = await loadCalendarWindow(propertyIds, newStart, newEnd)
        setCalendarDaysState((prev) => [...prev, ...res.days])
        setBlockedDatesState((prev) => [...prev, ...(res.blocked ?? [])])
        setLoadedEnd(newEnd)
      } else {
        const newEnd = addDaysStr(loadedStart, -1)
        const newStart = addDaysStr(loadedStart, -LOAD_CHUNK_DAYS)
        const el = scrollRef.current
        pendingPrependWidthRef.current = el ? el.scrollWidth : null
        const res = await loadCalendarWindow(propertyIds, newStart, newEnd)
        setCalendarDaysState((prev) => [...res.days, ...prev])
        setBlockedDatesState((prev) => [...(res.blocked ?? []), ...prev])
        setLoadedStart(newStart)
      }
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }

  // Tras insertar días al inicio (prepend), corrige el scrollLeft para que
  // la vista no "salte": el contenido que ya estabas viendo se queda igual.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (pendingPrependWidthRef.current != null && el) {
      const diff = el.scrollWidth - pendingPrependWidthRef.current
      el.scrollLeft += diff
      pendingPrependWidthRef.current = null
    }
  }, [loadedStart])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollLeft < LOAD_THRESHOLD_PX) {
      loadMore('before')
    } else if (el.scrollWidth - el.scrollLeft - el.clientWidth < LOAD_THRESHOLD_PX) {
      loadMore('after')
    }
  }

  function cellPointerDown(propertyId: string, date: string) {
    const k = key(propertyId, date)
    const mode = selected.has(k) ? 'remove' : 'add'
    setDragMode(mode)
    setSelected((prev) => {
      const next = new Set(prev)
      if (mode === 'add') next.add(k)
      else next.delete(k)
      return next
    })
  }

  function cellPointerEnter(propertyId: string, date: string) {
    if (!dragMode) return
    const k = key(propertyId, date)
    setSelected((prev) => {
      const next = new Set(prev)
      if (dragMode === 'add') next.add(k)
      else next.delete(k)
      return next
    })
  }

  function endDrag() {
    setDragMode(null)
  }

  function scrollByWeeks(weeks: number) {
    scrollRef.current?.scrollBy({ left: weeks * 7 * DAY_COL_WIDTH, behavior: 'smooth' })
  }

  function jumpToMonth(newMonth: number, newYear: number) {
    router.push(`/admin/calendario?y=${newYear}&m=${newMonth}`)
  }

  function jumpToToday() {
    const now = new Date()
    router.push(`/admin/calendario?y=${now.getFullYear()}&m=${now.getMonth() + 1}`)
  }

  // El calendario en sí no tiene límite de fechas (el scroll horizontal va
  // cargando más meses sin tope al acercarte al borde — ver loadMore más
  // abajo). Este selector de año es solo un atajo para saltar rápido; se
  // deja bastante amplio (20 años adelante) para que nunca se sienta
  // topado, aunque en la práctica casi nadie reserva con tanta anticipación.
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear()
    const start = Math.min(current - 1, year)
    const end = Math.max(current + 20, year)
    const list: number[] = []
    for (let y = start; y <= end; y++) list.push(y)
    return list
  }, [year])

  function applyRule() {
    if (!selectedRuleId || selected.size === 0) return
    setError(null)
    const selections: Selection[] = [...selected].map((k) => {
      const [propertyId, date] = k.split('|')
      return { propertyId, date }
    })
    startTransition(async () => {
      const res = await applyRuleToSelection(selectedRuleId, selections)
      if (res?.error) setError(res.error)
      else setSelected(new Set())
    })
  }

  function clearSelection() {
    setSelected(new Set())
  }

  function selectionToSelections(): Selection[] {
    return [...selected].map((k) => {
      const [propertyId, date] = k.split('|')
      return { propertyId, date }
    })
  }

  // Disponibilidad: bloquear o abrir manualmente las celdas seleccionadas.
  // Un bloqueo por iCal/reserva no se puede "abrir" desde aquí — sigue
  // apareciendo bloqueado, igual que en Airbnb.
  function setAvailability(blocked: boolean) {
    if (selected.size === 0) return
    setError(null)
    const selections = selectionToSelections()
    const noteToSave = blocked ? blockNoteInput.trim() || null : undefined
    startTransition(async () => {
      const res = await setManualBlock(selections, blocked, noteToSave)
      if (res?.error) {
        setError(res.error)
        return
      }
      const keySet = new Set(res.keys ?? [])
      setBlockedDatesState((prev) => [
        ...prev.filter((b) => !keySet.has(key(b.property_id, b.date))),
        ...(res.blocked ?? []),
      ])
      if (blocked) setBlockNoteInput('')
      // "Abrir fechas" solo quita bloqueos manuales — si alguna celda
      // seleccionada sigue bloqueada por una reserva real o por otro
      // calendario (iCal), no se libera aquí (para no des-sincronizar
      // Airbnb/Booking). Avisamos en vez de fallar en silencio.
      if (!blocked) {
        const stillBlocked = (res.blocked ?? []).filter((b) => b.source !== 'manual')
        if (stillBlocked.length > 0) {
          setError(
            `${stillBlocked.length} fecha(s) no se liberaron porque tienen una reserva real u otro calendario sincronizado. Para liberarlas, cancela la reserva desde el panel de detalle (ⓘ) de esa celda.`
          )
        }
      }
      setSelected(new Set())
    })
  }

  // Noches mínimas para las fechas exactas seleccionadas, con prioridad
  // sobre el mínimo de la propiedad y sobre cualquier regla aplicada.
  function saveMinNights() {
    if (selected.size === 0) return
    setError(null)
    const trimmed = minNightsInput.trim()
    const n = trimmed === '' ? null : Number(trimmed)
    if (n != null && (!Number.isFinite(n) || n < 1)) {
      setError('Las noches mínimas deben ser un número de al menos 1 (o vacío para quitar el ajuste).')
      return
    }
    const selections = selectionToSelections()
    startTransition(async () => {
      const res = await setMinNightsOverride(selections, n)
      if (res?.error) {
        setError(res.error)
        return
      }
      const keySet = new Set(selections.map((s) => key(s.propertyId, s.date)))
      setCalendarDaysState((prev) => [
        ...prev.filter((cd) => !keySet.has(key(cd.property_id, cd.date))),
        ...(res.days ?? []),
      ])
      setSelected(new Set())
      setMinNightsInput('')
    })
  }

  function handleRemoveApplication(id: string) {
    if (!window.confirm('¿Quitar esta regla de estas fechas? El precio de esos días vuelve al base.')) return
    startTransition(async () => {
      await removeApplication(id)
    })
  }

  function toggleQuickProperty(id: string) {
    setQuickProperties((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function applyQuick() {
    setQuickError(null)
    if (!quickRuleId) return setQuickError('Elige una regla.')
    if (quickProperties.size === 0) return setQuickError('Marca al menos una cabaña.')
    if (!quickStart || !quickEnd) return setQuickError('Pon fecha de inicio y fin.')
    if (quickEnd < quickStart) return setQuickError('La fecha final no puede ser antes que la inicial.')

    const dates: string[] = []
    const cur = new Date(`${quickStart}T00:00:00Z`)
    const last = new Date(`${quickEnd}T00:00:00Z`)
    while (cur <= last) {
      dates.push(cur.toISOString().slice(0, 10))
      cur.setUTCDate(cur.getUTCDate() + 1)
    }

    const selections: Selection[] = []
    for (const propertyId of quickProperties) {
      for (const date of dates) selections.push({ propertyId, date })
    }

    startTransition(async () => {
      const res = await applyRuleToSelection(quickRuleId, selections)
      if (res?.error) setQuickError(res.error)
      else {
        setQuickProperties(new Set())
        setQuickStart('')
        setQuickEnd('')
        setShowQuickApply(false)
      }
    })
  }

  return (
    <div onMouseUp={endDrag} onMouseLeave={endDrag} className="select-none">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollByWeeks(-1)}
            title="Retrocede una semana"
            className="rounded-lg border border-stone/30 px-2 py-1 text-sm text-navy-deep hover:bg-white"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => scrollByWeeks(1)}
            title="Avanza una semana"
            className="rounded-lg border border-stone/30 px-2 py-1 text-sm text-navy-deep hover:bg-white"
          >
            →
          </button>

          <select
            value={month}
            onChange={(e) => jumpToMonth(Number(e.target.value), year)}
            className="rounded-lg border border-stone/30 bg-white px-2 py-1.5 text-sm text-navy-deep"
          >
            {MONTH_LABELS.map((label, i) => (
              <option key={label} value={i + 1}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => jumpToMonth(month, Number(e.target.value))}
            className="rounded-lg border border-stone/30 bg-white px-2 py-1.5 text-sm text-navy-deep"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={jumpToToday}
            className="rounded-lg border border-stone/30 px-3 py-1.5 text-sm text-navy-deep hover:bg-white"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => setShowManualBooking(true)}
            className="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-navy-deep hover:bg-gold-light transition"
          >
            + Nueva reserva
          </button>
          <span className="text-xs text-stone hidden sm:inline">
            Desplázate con el mouse/trackpad sobre el calendario para moverte por los meses
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-stone">
          {rules.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {rules.map((r) => (
                <span key={r.id} className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.color ?? '#c9a24a' }} />
                  {r.name}
                </span>
              ))}
            </div>
          )}
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SOURCE_COLOR.airbnb }} />
            Airbnb
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SOURCE_COLOR.booking }} />
            Booking.com
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SOURCE_COLOR.direct }} />
            Reserva directa (este sitio)
          </span>
          <span className="flex items-center gap-1">
            <span
              className="h-2.5 w-2.5 rounded-sm border border-stone/30"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, rgba(90,90,90,0.35), rgba(90,90,90,0.35) 2px, rgba(90,90,90,0.08) 2px, rgba(90,90,90,0.08) 4px)',
              }}
            />
            Bloqueo manual / otra plataforma
          </span>
          <span className="text-stone/70">· clic en ⓘ para ver el detalle</span>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-stone/15 bg-white p-4">
        {showQuickApply ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-navy-deep">Aplicar regla por rango de fechas</h3>
              <button
                type="button"
                onClick={() => setShowQuickApply(false)}
                className="text-xs text-stone hover:text-navy-deep"
              >
                Cerrar
              </button>
            </div>

            <div>
              <span className="block text-xs font-medium text-stone mb-1">¿A qué cabañas aplica?</span>
              <div className="flex flex-wrap gap-3">
                {properties.map((p) => (
                  <label key={p.id} className="flex items-center gap-1.5 text-sm text-navy-deep">
                    <input
                      type="checkbox"
                      checked={quickProperties.has(p.id)}
                      onChange={() => toggleQuickProperty(p.id)}
                      className="rounded border-stone/40"
                    />
                    {p.name}
                  </label>
                ))}
                <button
                  type="button"
                  onClick={() => setQuickProperties(new Set(properties.map((p) => p.id)))}
                  className="text-xs text-gold underline underline-offset-2"
                >
                  Todas
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label>
                <span className="block text-xs font-medium text-stone mb-1">Regla</span>
                <select
                  value={quickRuleId}
                  onChange={(e) => setQuickRuleId(e.target.value)}
                  className="rounded-lg border border-stone/30 bg-white px-3 py-2 text-sm text-navy-deep"
                >
                  {rules.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="block text-xs font-medium text-stone mb-1">Desde</span>
                <input
                  type="date"
                  value={quickStart}
                  onChange={(e) => setQuickStart(e.target.value)}
                  className="rounded-lg border border-stone/30 bg-white px-3 py-2 text-sm text-navy-deep"
                />
              </label>
              <label>
                <span className="block text-xs font-medium text-stone mb-1">Hasta</span>
                <input
                  type="date"
                  value={quickEnd}
                  onChange={(e) => setQuickEnd(e.target.value)}
                  className="rounded-lg border border-stone/30 bg-white px-3 py-2 text-sm text-navy-deep"
                />
              </label>
              <button
                type="button"
                onClick={applyQuick}
                disabled={isPending}
                className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-cream hover:bg-navy-deep transition disabled:opacity-50"
              >
                {isPending ? 'Aplicando…' : 'Aplicar'}
              </button>
            </div>
            {quickError && <p className="text-sm text-burnt-orange">{quickError}</p>}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowQuickApply(true)}
            disabled={rules.length === 0}
            className="text-sm font-medium text-gold underline underline-offset-2 disabled:text-stone disabled:no-underline"
          >
            + Aplicar regla por rango de fechas (sin arrastrar el calendario)
          </button>
        )}
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
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
                Propiedad
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
                    {property.cover_photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={property.cover_photo_url}
                        alt=""
                        className="h-9 w-9 rounded-md object-cover shrink-0 border border-stone/15"
                      />
                    ) : (
                      <span className="h-9 w-9 rounded-md bg-cream shrink-0 border border-stone/15 flex items-center justify-center text-stone text-[10px]">
                        Sin foto
                      </span>
                    )}
                    <span className="truncate">{property.name}</span>
                  </div>
                </td>
                {days.map((d) => {
                  const cd = dayMap.get(key(property.id, d.date))
                  const isSelected = selected.has(key(property.id, d.date))
                  const color = cd?.applied_rule_id ? ruleColor.get(cd.applied_rule_id) : null
                  const blocked = blockedMap.get(key(property.id, d.date))
                  const kind = blocked ? blockedKind(blocked) : null
                  const solidColor = kind === 'airbnb' || kind === 'booking' || kind === 'direct' ? SOURCE_COLOR[kind] : null
                  const icalSource = blocked ? icalSourceOf(blocked) : null
                  const cellTitle = !blocked
                    ? undefined
                    : kind === 'airbnb' || kind === 'booking'
                      ? `Bloqueado — ${icalSource?.label ?? (kind === 'airbnb' ? 'Airbnb' : 'Booking.com')}${blocked.external_summary ? ` (${blocked.external_summary})` : ''}`
                      : kind === 'direct'
                        ? 'Bloqueado — reserva directa en este sitio'
                        : kind === 'manual'
                          ? `Bloqueado manualmente${blocked.note ? ` — ${blocked.note}` : ''}`
                          : `Bloqueado — ${icalSource?.label ?? 'calendario externo'}${blocked.external_summary ? ` (${blocked.external_summary})` : ''}`
                  return (
                    <td
                      key={d.date}
                      title={cellTitle}
                      onMouseDown={() => cellPointerDown(property.id, d.date)}
                      onMouseEnter={() => cellPointerEnter(property.id, d.date)}
                      style={
                        isSelected
                          ? undefined
                          : solidColor
                            ? { backgroundColor: `${solidColor}33`, boxShadow: `inset 3px 0 0 0 ${solidColor}` }
                            : blocked
                              ? {
                                  backgroundImage:
                                    'repeating-linear-gradient(45deg, rgba(90,90,90,0.18), rgba(90,90,90,0.18) 4px, rgba(90,90,90,0.06) 4px, rgba(90,90,90,0.06) 8px)',
                                }
                              : color
                                ? { backgroundColor: `${color}2e`, boxShadow: `inset 3px 0 0 0 ${color}` }
                                : undefined
                      }
                      className={`relative border-b border-stone/10 text-center px-1 py-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-gold/30 ring-1 ring-inset ring-gold'
                          : !color && !blocked
                            ? 'hover:bg-cream'
                            : ''
                      }`}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={blocked ? 'text-stone line-through' : 'text-navy-deep'}>
                          {cd ? Math.round(Number(cd.price_mxn)).toLocaleString('es-MX') : '—'}
                        </span>
                      </div>
                      {blocked && (
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation()
                            openDetails(property.id, d.date, blocked)
                          }}
                          title="Ver detalle"
                          className="absolute top-0 right-0 h-3.5 w-3.5 rounded-bl bg-navy-deep/70 text-cream text-[9px] leading-[14px] font-bold hover:bg-navy-deep"
                        >
                          i
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {loadingMore && (
          <div className="px-3 py-1.5 text-center text-xs text-stone border-t border-stone/10">Cargando más días…</div>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-stone/15 bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-stone">{selected.size} celda(s) seleccionada(s)</span>
          {selected.size > 0 && (
            <button type="button" onClick={clearSelection} className="text-sm text-stone hover:text-navy-deep">
              Limpiar selección
            </button>
          )}
          {error && <span className="text-sm text-burnt-orange">{error}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-stone/10">
          <span className="text-xs font-medium text-stone uppercase tracking-wide w-full sm:w-auto">
            Disponibilidad
          </span>
          <button
            type="button"
            disabled={selected.size === 0 || isPending}
            onClick={() => setAvailability(false)}
            className="rounded-lg border border-olive-deep text-olive-deep px-3 py-1.5 text-sm font-medium hover:bg-olive-deep/10 transition disabled:opacity-40"
          >
            Abrir fechas
          </button>
          <button
            type="button"
            disabled={selected.size === 0 || isPending}
            onClick={() => setAvailability(true)}
            className="rounded-lg border border-burnt-orange text-burnt-orange px-3 py-1.5 text-sm font-medium hover:bg-burnt-orange/10 transition disabled:opacity-40"
          >
            Bloquear fechas
          </button>
          <label className="flex items-center gap-2">
            <span className="text-xs text-stone">Nota (opcional):</span>
            <input
              type="text"
              placeholder="Ej. Mantenimiento, uso personal…"
              value={blockNoteInput}
              onChange={(e) => setBlockNoteInput(e.target.value)}
              disabled={selected.size === 0}
              className="w-56 rounded-lg border border-stone/30 bg-white px-3 py-1.5 text-sm text-navy-deep disabled:opacity-50"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-end gap-3 pt-3 border-t border-stone/10">
          <label>
            <span className="block text-xs font-medium text-stone uppercase tracking-wide mb-1">
              Noches mínimas
            </span>
            <input
              type="number"
              min={1}
              placeholder="Ej. 2"
              value={minNightsInput}
              onChange={(e) => setMinNightsInput(e.target.value)}
              disabled={selected.size === 0}
              className="w-24 rounded-lg border border-stone/30 bg-white px-3 py-1.5 text-sm text-navy-deep disabled:opacity-50"
            />
          </label>
          <button
            type="button"
            disabled={selected.size === 0 || isPending}
            onClick={saveMinNights}
            className="rounded-lg bg-navy px-4 py-1.5 text-sm font-medium text-cream hover:bg-navy-deep transition disabled:opacity-40"
          >
            {isPending ? 'Guardando…' : 'Guardar noches mínimas'}
          </button>
          <span className="text-xs text-stone">Deja el campo vacío y guarda para quitar el ajuste.</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-stone/10">
          {rules.length > 0 ? (
            <>
              <span className="text-xs font-medium text-stone uppercase tracking-wide w-full sm:w-auto">
                Regla de precio
              </span>
              <select
                value={selectedRuleId}
                onChange={(e) => setSelectedRuleId(e.target.value)}
                className="rounded-lg border border-stone/30 bg-white px-3 py-2 text-sm text-navy-deep"
              >
                {rules.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={selected.size === 0 || isPending}
                onClick={applyRule}
                className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-cream hover:bg-navy-deep transition disabled:opacity-50"
              >
                {isPending ? 'Aplicando…' : 'Aplicar regla a selección'}
              </button>
            </>
          ) : (
            <a href="/admin/reglas" className="text-sm text-gold underline underline-offset-2">
              Crea una regla primero
            </a>
          )}
        </div>
      </div>

      {applications.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-navy-deep mb-3 uppercase tracking-wide">
            Reglas aplicadas en este periodo
          </h2>
          <div className="space-y-2">
            {applications.map((app) => {
              const property = properties.find((p) => p.id === app.property_id)
              return (
                <div
                  key={app.id}
                  className="flex items-center justify-between rounded-lg border border-stone/15 bg-white px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: app.pricing_rules?.color ?? '#c9a24a' }}
                    />
                    <span className="text-navy-deep font-medium">{app.pricing_rules?.name}</span>
                    <span className="text-stone">
                      · {property?.name} · {app.start_date} → {app.end_date}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveApplication(app.id)}
                    disabled={isPending}
                    className="text-burnt-orange hover:underline text-xs"
                  >
                    Quitar
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {detailsFor && (() => {
        const blocked = detailsBlocked
        const kind = detailsKind
        const property = properties.find((p) => p.id === detailsFor.propertyId)
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/40 p-4"
            onMouseDown={closeDetails}
          >
            <div
              onMouseDown={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-navy-deep">{property?.name}</h3>
                  <p className="text-xs text-stone">{detailsFor.date}</p>
                </div>
                <button type="button" onClick={closeDetails} className="text-stone hover:text-navy-deep text-sm">
                  Cerrar ✕
                </button>
              </div>

              {kind === 'direct' ? (
                loadingDetails ? (
                  <p className="text-sm text-stone">Cargando…</p>
                ) : detailsError ? (
                  <p className="text-sm text-burnt-orange">{detailsError}</p>
                ) : bookingDetails ? (
                  <dl className="text-sm space-y-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: SOURCE_COLOR.direct }}
                      />
                      <span className="text-navy-deep font-medium">Reserva directa — {bookingDetails.status}</span>
                    </div>
                    <div>
                      <dt className="text-xs text-stone">Huésped</dt>
                      <dd className="text-navy-deep">{bookingDetails.guest_name}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-stone">Contacto</dt>
                      <dd className="text-navy-deep">
                        {bookingDetails.guest_email || '—'} · {bookingDetails.guest_phone || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-stone">Fechas</dt>
                      <dd className="text-navy-deep">
                        {bookingDetails.check_in} → {bookingDetails.check_out}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-stone">Huéspedes</dt>
                      <dd className="text-navy-deep">
                        {bookingDetails.adults} adultos, {bookingDetails.children} niños,{' '}
                        {bookingDetails.infants} infantes · Mascotas: {bookingDetails.pets ? 'Sí' : 'No'}
                      </dd>
                    </div>
                    {bookingDetails.guest_notes && (
                      <div>
                        <dt className="text-xs text-stone">Notas del huésped</dt>
                        <dd className="text-navy-deep">{bookingDetails.guest_notes}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-xs text-stone">Total pagado</dt>
                      <dd className="text-navy-deep">
                        ${Math.round(Number(bookingDetails.total_price_mxn)).toLocaleString('es-MX')} MXN ·{' '}
                        {bookingDetails.payment_provider === 'stripe'
                          ? 'Stripe'
                          : bookingDetails.payment_provider === 'mercadopago'
                            ? 'Mercado Pago'
                            : (bookingDetails.payment_provider ?? '—')}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-stone">Reservado el</dt>
                      <dd className="text-navy-deep">
                        {new Date(bookingDetails.created_at).toLocaleString('es-MX', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </dd>
                    </div>
                  </dl>
                ) : null
              ) : kind === 'airbnb' || kind === 'booking' || kind === 'ical-otro' ? (
                <div className="text-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: solidColorFor(kind) }}
                    />
                    <span className="text-navy-deep font-medium">
                      {kind === 'airbnb' ? 'Reserva en Airbnb' : kind === 'booking' ? 'Reserva en Booking.com' : 'Bloqueado por calendario externo'}
                    </span>
                  </div>
                  <div>
                    <dt className="text-xs text-stone">Calendario importado</dt>
                    <dd className="text-navy-deep">{icalSourceOf(blocked!)?.label ?? '—'}</dd>
                  </div>
                  {blocked?.external_summary && (
                    <div>
                      <dt className="text-xs text-stone">Texto del evento (tal cual lo manda la plataforma)</dt>
                      <dd className="text-navy-deep">{blocked.external_summary}</dd>
                    </div>
                  )}
                  <p className="text-stone text-xs pt-1 border-t border-stone/10">
                    {kind === 'ical-otro'
                      ? 'Esta plataforma no comparte los datos del huésped por calendario (iCal) — esto es lo único que trae el evento.'
                      : 'Esta fecha está bloqueada porque ya hay una reserva en esa plataforma. No comparte los datos del huésped por esta vía (es una limitación de la plataforma, no de este sitio) — para verlos entra a su panel.'}
                  </p>
                </div>
              ) : kind === 'manual' ? (
                <div className="text-sm space-y-2">
                  <p className="text-stone">Bloqueaste esta fecha manualmente desde el calendario.</p>
                  {blocked?.note && (
                    <div>
                      <dt className="text-xs text-stone">Nota</dt>
                      <dd className="text-navy-deep">{blocked.note}</dd>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-stone">Bloqueado por un calendario externo sincronizado.</p>
              )}

              {kind === 'direct' && bookingDetails && (
                <div className="mt-4 pt-4 border-t border-stone/10 space-y-3">
                  {actionError && <p className="text-sm text-burnt-orange">{actionError}</p>}
                  {actionMessage && <p className="text-sm text-navy-deep">{actionMessage}</p>}
                </div>
              )}

              {kind === 'direct' && bookingDetails && bookingDetails.status !== 'cancelled' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-stone block mb-1">Mover a otra cabaña</label>
                    <div className="flex gap-2">
                      <select
                        value={moveTarget}
                        onChange={(e) => setMoveTarget(e.target.value)}
                        className="flex-1 rounded-lg border border-stone/30 px-2 py-1.5 text-sm"
                      >
                        <option value="">Elegir cabaña…</option>
                        {properties
                          .filter((p) => p.id !== detailsFor?.propertyId)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        disabled={!moveTarget || movingBooking}
                        onClick={handleMoveBooking}
                        className="rounded-lg bg-navy-deep px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-deep/90 transition disabled:opacity-50"
                      >
                        {movingBooking ? 'Moviendo…' : 'Mover'}
                      </button>
                    </div>
                  </div>

                  {!confirmingCancel ? (
                    <button
                      type="button"
                      onClick={() => setConfirmingCancel(true)}
                      className="text-xs text-burnt-orange underline underline-offset-2"
                    >
                      Cancelar esta reserva
                    </button>
                  ) : (
                    <div className="rounded-lg border border-burnt-orange/30 bg-burnt-orange/5 p-3 space-y-2">
                      <p className="text-xs text-navy-deep">
                        Esto libera las fechas y marca la reserva como cancelada. Esta acción no se puede deshacer.
                      </p>
                      <label className="flex items-center gap-2 text-xs text-navy-deep">
                        <input
                          type="checkbox"
                          checked={cancelWithRefund}
                          onChange={(e) => setCancelWithRefund(e.target.checked)}
                        />
                        Reembolsar el pago al huésped
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={cancellingBooking}
                          onClick={handleCancelBooking}
                          className="rounded-lg bg-burnt-orange px-3 py-1.5 text-xs font-semibold text-white hover:bg-burnt-orange/90 transition disabled:opacity-50"
                        >
                          {cancellingBooking
                            ? 'Cancelando…'
                            : cancelWithRefund
                              ? 'Confirmar cancelación y reembolsar'
                              : 'Confirmar cancelación sin reembolso'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingCancel(false)}
                          className="rounded-lg px-3 py-1.5 text-xs text-stone hover:text-navy-deep transition"
                        >
                          Ya no
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {kind === 'direct' && bookingDetails?.status === 'cancelled' && (
                <p className="mt-4 pt-4 border-t border-stone/10 text-xs text-stone">
                  Esta reserva está cancelada — las fechas ya están libres.
                </p>
              )}

            </div>
          </div>
        )
      })()}

      {showManualBooking && (
        <ManualBookingModal
          properties={properties}
          onClose={() => setShowManualBooking(false)}
          onCreated={() => {
            // Recargamos en vez de actualizar el estado local a mano: así el
            // bloqueo queda con su booking_id real de una vez (necesario
            // para que el panel de detalle ⓘ pueda abrirlo).
            setShowManualBooking(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
