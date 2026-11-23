import Link from 'next/link'
import { requireStaff, staffOwnerKey } from '@/lib/staff'
import { STAY_COLUMNS, stayLines, paymentText, waLink, type ManualStay } from '@/lib/manual-stays'
import { SITE_URL } from '@/lib/site'
import IcalPanel from '@/app/socios/(panel)/cabana/IcalPanel'
import { staffAddIcal, staffDeleteIcal, staffMoveStay, staffSetBlock, staffUpdateStayPayment } from './actions'
import MultiCalendar from './MultiCalendar'
import { loadCalendarDays } from '@/lib/calendar-days'
import { createServiceClient } from '@/lib/supabase/service'
import { todayInMexicoStr } from '@/lib/dates'
import StaffCalendar, { type DayInfo } from './StaffCalendar'

export const dynamic = 'force-dynamic'

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function shortDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

export default async function EquipoPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const staff = await requireStaff()
  const { p } = await searchParams

  if (staff.properties.length === 0) {
    return (
      <p className="rounded-2xl border border-stone/15 bg-white p-6 text-sm text-stone text-center">
        Todavía no tienes propiedades asignadas. Pídele al anfitrión que te dé acceso.
      </p>
    )
  }

  const today = todayInMexicoStr()
  const until = addDays(today, 400)
  const service = createServiceClient()

  // Con varias cabañas, la vista principal es la lista (una fila por cabaña).
  // Tocar el nombre abre el detalle de esa cabaña (calendario por meses,
  // reservas e iCal).
  if (staff.properties.length > 1 && !staff.properties.some((x) => x.id === p)) {
    const ids = staff.properties.map((x) => x.id)
    const [days, { data: photos }] = await Promise.all([
      loadCalendarDays(service, {
        propertyIds: ids,
        from: today,
        until,
        showBookingGuests: staff.can_view_bookings,
        showGuestContact: staff.can_view_bookings && staff.can_view_guest_contact,
        stayOwnerKey: staff.can_view_bookings ? null : staffOwnerKey(staff),
        hostLabel: 'el anfitrión',
      }),
      service.from('property_photos').select('property_id, url, sort_order').in('property_id', ids).order('sort_order'),
    ])
    const photo = new Map<string, string>()
    for (const ph of photos ?? []) if (!photo.has(ph.property_id)) photo.set(ph.property_id, ph.url)

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-navy-deep">Calendario de tus cabañas</h1>
          <p className="text-sm text-stone mt-1">
            {staff.can_block_dates
              ? 'Toca los días (de una o varias cabañas) y elige Bloquear o Desbloquear. Si es una reserva por fuera, marca "Es una reserva" y anota los datos del huésped. Toca un día ocupado para ver quién es. Toca el nombre de una cabaña para ver su detalle y conectar sus calendarios.'
              : 'Aquí ves qué días están libres y cuáles ocupados. Toca un día ocupado para ver quién es.'}
          </p>
        </div>
        <MultiCalendar
          properties={staff.properties.map((x) => ({ id: x.id, name: x.name, photo: photo.get(x.id) ?? null, href: `/equipo?p=${x.id}` }))}
          today={today}
          days={days}
          canBlock={staff.can_block_dates}
          setBlock={staffSetBlock}
          stayActions={{ updatePayment: staffUpdateStayPayment, move: staffMoveStay }}
        />
      </div>
    )
  }

  const property = staff.properties.find((x) => x.id === p) ?? staff.properties[0]

  // Datos de huéspedes de reservas por fuera: solo los de su grupo (él, su
  // jefe y su equipo), salvo que el anfitrión le haya dado "Ver reservas".
  let staysQuery = service.from('manual_stays').select(STAY_COLUMNS).eq('property_id', property.id).gte('check_out', today)
  if (!staff.can_view_bookings) staysQuery = staysQuery.eq('owner_key', staffOwnerKey(staff))

  const [{ data: blocked }, { data: bookings }, { data: staysData }, { data: icalSources }] = await Promise.all([
    service
      .from('blocked_dates')
      .select('date, source, note, blocked_by, booking_id, stay_id, ical_sources(platform, label)')
      .eq('property_id', property.id)
      .gte('date', today)
      .lt('date', until),
    staff.can_view_bookings
      ? service
          .from('bookings')
          .select('id, guest_name, guest_phone, guest_email, check_in, check_out, adults, children, infants, pets, source')
          .eq('property_id', property.id)
          .eq('status', 'confirmed')
          .gte('check_out', today)
          .order('check_in')
          .limit(60)
      : Promise.resolve({
          data: [] as {
            id: string
            guest_name: string | null
            guest_phone: string | null
            guest_email: string | null
            check_in: string
            check_out: string
            adults: number
            children: number
            infants: number
            pets: boolean
            source: string
          }[],
        }),
    staysQuery.order('check_in'),
    staff.can_block_dates
      ? service
          .from('ical_sources')
          .select('id, label, platform, last_synced_at, last_sync_status, added_by_staff_id')
          .eq('property_id', property.id)
          .order('created_at')
      : Promise.resolve({ data: [] as never[] }),
  ])
  const stays = (staysData ?? []) as ManualStay[]
  const stayById = new Map(stays.map((st) => [st.id, st]))

  // Nombre del huésped de cada reserva (solo si este colaborador puede ver
  // reservas), para mostrar de quién es el bloqueo.
  const guestByBooking = new Map<string, string>()
  for (const b of bookings ?? []) if (b.guest_name) guestByBooking.set(b.id, b.guest_name)

  const days: Record<string, DayInfo> = {}
  for (const row of blocked ?? []) {
    const src = Array.isArray(row.ical_sources) ? row.ical_sources[0] : row.ical_sources
    const stay = row.stay_id ? stayById.get(row.stay_id) : undefined
    if (row.source === 'manual' && stay)
      days[row.date] = {
        kind: 'manual',
        label: `Reserva por fuera — ${stay.guest_name}${row.note ? ` (${row.note})` : ''}`,
        tag: stay.guest_name.split(' ')[0],
        details: stayLines(stay),
        stay: { id: stay.id, paid: stay.paid_mxn, balance: stay.balance_mxn },
        phone: stay.guest_phone,
      }
    else if (row.source === 'manual')
      days[row.date] = {
        kind: 'manual',
        label: `Bloqueado${row.blocked_by ? ` por ${row.blocked_by}` : ' por el anfitrión'}${row.note ? ` — ${row.note}` : ''}`,
        tag: row.blocked_by ? row.blocked_by.split(' ')[0] : 'Anfitrión',
      }
    else if (row.source === 'booking') {
      const guest = row.booking_id ? guestByBooking.get(row.booking_id) : undefined
      days[row.date] = {
        kind: 'booking',
        label: guest ? `Reserva — ${guest}` : 'Reservado',
        tag: 'Reserva',
      }
    }
    else days[row.date] = { kind: 'external', label: `Ocupado en ${src?.label ?? src?.platform ?? 'otra plataforma'}` }
  }

  return (
    <div className="space-y-6">
      {staff.properties.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Link
            href="/equipo"
            className="rounded-full border border-stone/25 bg-white px-4 py-1.5 text-sm text-navy-deep transition hover:border-gold"
          >
            ← Todas
          </Link>
          {staff.properties.map((x) => (
            <Link
              key={x.id}
              href={`/equipo?p=${x.id}`}
              className={`rounded-full px-4 py-1.5 text-sm transition ${
                x.id === property.id
                  ? 'bg-navy-deep text-cream'
                  : 'border border-stone/25 bg-white text-navy-deep hover:border-gold'
              }`}
            >
              {x.name}
            </Link>
          ))}
        </div>
      )}

      <div>
        <h1 className="text-xl font-semibold text-navy-deep">{property.name}</h1>
        <p className="text-sm text-stone mt-1">
          {staff.can_block_dates
            ? 'Toca los días para seleccionarlos y luego elige Bloquear o Desbloquear. Si es una reserva por fuera, marca "Es una reserva" y anota los datos del huésped: los verás al tocar el día. Los bloqueos se pasan solos a Airbnb/Booking (puede tardar unas horas en reflejarse allá).'
            : 'Aquí puedes ver qué días están libres y cuáles ocupados.'}
        </p>
      </div>

      <StaffCalendar
        propertyId={property.id}
        today={today}
        days={days}
        canBlock={staff.can_block_dates}
        moveTargets={staff.properties.filter((x) => x.id !== property.id).map((x) => ({ id: x.id, name: x.name }))}
      />

      {stays.length > 0 && (
        <section className="rounded-2xl border border-stone/15 bg-white p-4 sm:p-5">
          <h2 className="font-medium text-navy-deep mb-3">Reservas por fuera (las que anotaron tú o tu equipo)</h2>
          <ul className="divide-y divide-stone/10">
            {stays.map((st) => (
              <li key={st.id} className="py-2.5 text-sm">
                <p className="text-navy-deep font-medium">
                  {shortDate(st.check_in)} → {shortDate(st.check_out)} · {st.guest_name}
                  {st.guests ? ` · ${st.guests} persona(s)` : ''}
                </p>
                <p className="text-stone">
                  {[paymentText(st), st.channel, st.notes, `anotó ${st.created_by}`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {st.guest_phone && (
                  <a href={waLink(st.guest_phone)} target="_blank" rel="noreferrer" className="text-xs text-[#128C7E] underline underline-offset-2">
                    WhatsApp {st.guest_phone}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {staff.can_block_dates && (
        <IcalPanel
          propertyId={property.id}
          exportUrl={`${SITE_URL}/api/ical/${property.id}`}
          sources={(icalSources ?? []).map((src) => ({
            id: src.id as string,
            label: src.label as string,
            platform: src.platform as string,
            last_synced_at: src.last_synced_at as string | null,
            last_sync_status: src.last_sync_status as string | null,
            removable: src.added_by_staff_id === staff.id,
          }))}
          addAction={staffAddIcal.bind(null, property.id)}
          deleteAction={staffDeleteIcal}
          intro="Si esta cabaña también se renta en Airbnb, Booking u otra plataforma, conecta aquí su calendario para que esas fechas se bloqueen solas. Lo que reserves por WhatsApp o en persona, bloquéalo en el calendario de arriba el mismo día."
        />
      )}

      {staff.can_view_bookings && (
        <section className="rounded-2xl border border-stone/15 bg-white p-4 sm:p-5">
          <h2 className="font-medium text-navy-deep mb-3">Próximas reservas</h2>
          {(bookings ?? []).length === 0 ? (
            <p className="text-sm text-stone">No hay reservas próximas en esta página.</p>
          ) : (
            <ul className="divide-y divide-stone/10">
              {(bookings ?? []).map((b) => {
                const guests = `${b.adults} adultos${b.children ? `, ${b.children} niños` : ''}${b.infants ? `, ${b.infants} bebés` : ''}${b.pets ? ', con mascota' : ''}`
                return (
                  <li key={b.id} className="py-2.5 text-sm">
                    <p className="text-navy-deep font-medium">
                      {shortDate(b.check_in)} → {shortDate(b.check_out)} · {b.guest_name || 'Huésped'}
                    </p>
                    <p className="text-stone">{guests}</p>
                    {staff.can_view_guest_contact && (b.guest_phone || b.guest_email) && (
                      <p className="text-stone">
                        {b.guest_phone && (
                          <a href={`tel:${b.guest_phone}`} className="underline underline-offset-2">
                            {b.guest_phone}
                          </a>
                        )}
                        {b.guest_phone && b.guest_email ? ' · ' : ''}
                        {b.guest_email}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
