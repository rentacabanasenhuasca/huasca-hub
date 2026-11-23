// Arma el estado de cada día (libre / bloqueado a mano / reserva / otra
// plataforma) para los calendarios de colaboradores (/equipo) y socios
// (/socios), de una o varias propiedades a la vez.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { DayInfo } from '@/app/equipo/StaffCalendar'
import { STAY_COLUMNS, stayLines, type ManualStay } from '@/lib/manual-stays'

type BlockedRow = {
  property_id: string
  date: string
  source: string
  note: string | null
  blocked_by: string | null
  booking_id: string | null
  stay_id: string | null
  ical_sources: { platform: string; label: string } | { platform: string; label: string }[] | null
}

type BookingRow = {
  id: string
  guest_name: string | null
  guest_phone: string | null
  check_in: string
  check_out: string
  adults: number | null
  children: number | null
  infants: number | null
  pets: boolean | null
  guest_notes: string | null
  booking_addons: { name: string; quantity: number | null; answers: { label: string; value: string }[] | null }[] | null
}

function shortDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** Renglones del panel de información para una reserva hecha en el sitio. */
function bookingLines(b: BookingRow, withContact: boolean) {
  const nights = Math.round((Date.parse(b.check_out) - Date.parse(b.check_in)) / 86_400_000)
  const people = [
    `${b.adults ?? 0} adulto${b.adults === 1 ? '' : 's'}`,
    b.children ? `${b.children} niño${b.children === 1 ? '' : 's'}` : null,
    b.infants ? `${b.infants} bebé${b.infants === 1 ? '' : 's'}` : null,
    b.pets ? 'con mascota' : null,
  ]
    .filter(Boolean)
    .join(', ')
  const lines = [
    `Estancia: ${shortDate(b.check_in)} → ${shortDate(b.check_out)} (${nights} noche${nights === 1 ? '' : 's'})`,
    `Personas: ${people}`,
  ]
  if (withContact && b.guest_phone) lines.push(`Teléfono: ${b.guest_phone}`)
  for (const a of b.booking_addons ?? []) {
    const answers = (a.answers ?? [])
      .filter((x) => x && x.value)
      .map((x) => `${x.label}: ${x.value}`)
      .join(' · ')
    lines.push(`Extra: ${a.name}${a.quantity && a.quantity > 1 ? ` ×${a.quantity}` : ''}${answers ? ` (${answers})` : ''}`)
  }
  if (b.guest_notes) lines.push(`Notas del huésped: ${b.guest_notes}`)
  return lines
}

/** Supabase regresa máximo 1000 filas por consulta: aquí se pagina. */
async function allBlocked(service: SupabaseClient, propertyIds: string[], from: string, until: string) {
  const rows: BlockedRow[] = []
  for (let offset = 0; offset < 20000; offset += 1000) {
    const { data } = await service
      .from('blocked_dates')
      .select('property_id, date, source, note, blocked_by, booking_id, stay_id, ical_sources(platform, label)')
      .in('property_id', propertyIds)
      .gte('date', from)
      .lt('date', until)
      .order('property_id')
      .order('date')
      .range(offset, offset + 999)
    rows.push(...((data ?? []) as unknown as BlockedRow[]))
    if (!data || data.length < 1000) break
  }
  return rows
}

export async function loadCalendarDays(
  service: SupabaseClient,
  opts: {
    propertyIds: string[]
    from: string
    until: string
    // Nombre del huésped en las reservas del sitio (si puede verlas).
    showBookingGuests: boolean
    // Teléfono del huésped en las reservas del sitio (permiso aparte).
    showGuestContact?: boolean
    // Solo las reservas por fuera de este grupo (null = todas).
    stayOwnerKey: string | null
    // Cómo se llama al anfitrión en un bloqueo sin autor.
    hostLabel: string
  }
): Promise<Record<string, Record<string, DayInfo>>> {
  const { propertyIds, from, until } = opts
  const result: Record<string, Record<string, DayInfo>> = {}
  for (const id of propertyIds) result[id] = {}
  if (propertyIds.length === 0) return result

  let staysQuery = service.from('manual_stays').select(STAY_COLUMNS).in('property_id', propertyIds).gte('check_out', from)
  if (opts.stayOwnerKey) staysQuery = staysQuery.eq('owner_key', opts.stayOwnerKey)

  const [blocked, { data: bookings }, { data: stays }] = await Promise.all([
    allBlocked(service, propertyIds, from, until),
    opts.showBookingGuests
      ? service
          .from('bookings')
          .select(
            'id, guest_name, guest_phone, check_in, check_out, adults, children, infants, pets, guest_notes, booking_addons(name, quantity, answers)'
          )
          .in('property_id', propertyIds)
          .eq('status', 'confirmed')
          .gte('check_out', from)
      : Promise.resolve({ data: [] as BookingRow[] }),
    staysQuery,
  ])

  const bookingById = new Map(((bookings ?? []) as unknown as BookingRow[]).map((b) => [b.id, b]))
  const stayById = new Map(((stays ?? []) as ManualStay[]).map((s) => [s.id, s]))

  for (const row of blocked) {
    const days = result[row.property_id]
    if (!days) continue
    const src = Array.isArray(row.ical_sources) ? row.ical_sources[0] : row.ical_sources
    const stay = row.stay_id ? stayById.get(row.stay_id) : undefined
    if (row.source === 'manual' && stay) {
      days[row.date] = {
        kind: 'manual',
        label: `Reserva por fuera — ${stay.guest_name}${row.note ? ` (${row.note})` : ''}`,
        tag: stay.guest_name.split(' ')[0],
        details: stayLines(stay),
        phone: stay.guest_phone,
      }
    } else if (row.source === 'manual') {
      days[row.date] = {
        kind: 'manual',
        label: `Bloqueado${row.blocked_by ? ` por ${row.blocked_by}` : ` por ${opts.hostLabel}`}${row.note ? ` — ${row.note}` : ''}`,
        tag: row.blocked_by ? row.blocked_by.split(' ')[0] : 'Anfitrión',
      }
    } else if (row.source === 'booking') {
      const b = row.booking_id ? bookingById.get(row.booking_id) : undefined
      const guest = b?.guest_name ?? ''
      days[row.date] = {
        kind: 'booking',
        label: guest ? `Reserva en el sitio — ${guest}` : 'Reserva en el sitio',
        tag: guest ? guest.split(' ')[0] : 'Reserva',
        details: b ? bookingLines(b, Boolean(opts.showGuestContact)) : undefined,
        phone: b && opts.showGuestContact ? b.guest_phone : null,
      }
    } else {
      const platform = src?.label ?? src?.platform ?? 'otra plataforma'
      days[row.date] = { kind: 'external', label: `Ocupado en ${platform}`, tag: platform }
    }
  }
  return result
}
