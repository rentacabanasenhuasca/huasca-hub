import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requirePartner } from '@/lib/partners'
import { createServiceClient } from '@/lib/supabase/service'
import { todayInMexicoStr } from '@/lib/dates'
import { loadCalendarDays } from '@/lib/calendar-days'
import MultiCalendar from '@/app/equipo/MultiCalendar'
import { partnerSetBlock } from '../../actions'

export const dynamic = 'force-dynamic'

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Calendario de todas las cabañas del socio en forma de lista (una fila por
// cabaña). Con una sola cabaña, manda directo a su calendario por meses.
export default async function SocioCalendarioPage() {
  const partner = await requirePartner()
  const service = createServiceClient()
  const { data: properties } = await service
    .from('properties')
    .select('id, name, property_photos(url, sort_order)')
    .eq('partner_id', partner.id)
    .neq('partner_state', 'removed')
    .order('name')

  const list = properties ?? []
  if (list.length === 0) {
    return (
      <div className="rounded-2xl border border-stone/15 bg-white p-6 text-center text-sm text-stone">
        Todavía no registras ninguna cabaña.{' '}
        <Link href="/socios/cabana/nueva" className="text-gold underline underline-offset-2">
          Registrar mi cabaña
        </Link>
      </div>
    )
  }
  if (list.length === 1) redirect(`/socios/cabana/${list[0].id}/calendario`)

  const today = todayInMexicoStr()
  const days = await loadCalendarDays(service, {
    propertyIds: list.map((p) => p.id as string),
    from: today,
    until: addDays(today, 400),
    showBookingGuests: true,
    stayOwnerKey: null,
    hostLabel: 'Huasca Retreats',
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-navy-deep">Calendario de tus cabañas</h1>
        <p className="text-sm text-stone mt-1">
          Toca los días (de una o varias cabañas) y elige Bloquear o Desbloquear. Bloquea cada fecha que reserves por fuera el mismo día; si es
          una reserva, marca &quot;Es una reserva&quot; y anota los datos del huésped. Toca el nombre de una cabaña para ver su calendario por meses.
        </p>
      </div>
      <MultiCalendar
        properties={list.map((p) => {
          const photos = ((p.property_photos ?? []) as { url: string; sort_order: number }[]).sort((a, b) => a.sort_order - b.sort_order)
          return { id: p.id as string, name: p.name as string, photo: photos[0]?.url ?? null, href: `/socios/cabana/${p.id}/calendario` }
        })}
        today={today}
        days={days}
        canBlock
        setBlock={partnerSetBlock}
      />
    </div>
  )
}
