import Link from 'next/link'
import { requireStaff } from '@/lib/staff'
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

  const property = staff.properties.find((x) => x.id === p) ?? staff.properties[0]
  const today = todayInMexicoStr()
  const until = addDays(today, 400)
  const service = createServiceClient()

  const [{ data: blocked }, { data: bookings }] = await Promise.all([
    service
      .from('blocked_dates')
      .select('date, source, note, booking_id, ical_sources(platform, label)')
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
            pets: number
            source: string
          }[],
        }),
  ])

  const days: Record<string, DayInfo> = {}
  for (const row of blocked ?? []) {
    const src = Array.isArray(row.ical_sources) ? row.ical_sources[0] : row.ical_sources
    if (row.source === 'manual') days[row.date] = { kind: 'manual', label: row.note ?? 'Bloqueado' }
    else if (row.source === 'booking') days[row.date] = { kind: 'booking', label: 'Reservado' }
    else days[row.date] = { kind: 'external', label: `Ocupado en ${src?.label ?? src?.platform ?? 'otra plataforma'}` }
  }

  return (
    <div className="space-y-6">
      {staff.properties.length > 1 && (
        <div className="flex flex-wrap gap-2">
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
            ? 'Toca los días para seleccionarlos y luego elige Bloquear o Desbloquear. Los bloqueos se pasan solos a Airbnb (puede tardar unas horas en reflejarse allá).'
            : 'Aquí puedes ver qué días están libres y cuáles ocupados.'}
        </p>
      </div>

      <StaffCalendar
        propertyId={property.id}
        today={today}
        days={days}
        canBlock={staff.can_block_dates}
      />

      {staff.can_view_bookings && (
        <section className="rounded-2xl border border-stone/15 bg-white p-4 sm:p-5">
          <h2 className="font-medium text-navy-deep mb-3">Próximas reservas</h2>
          {(bookings ?? []).length === 0 ? (
            <p className="text-sm text-stone">No hay reservas próximas en esta página.</p>
          ) : (
            <ul className="divide-y divide-stone/10">
              {(bookings ?? []).map((b) => {
                const guests = `${b.adults} adultos${b.children ? `, ${b.children} niños` : ''}${b.infants ? `, ${b.infants} bebés` : ''}${b.pets ? `, ${b.pets} mascota(s)` : ''}`
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
