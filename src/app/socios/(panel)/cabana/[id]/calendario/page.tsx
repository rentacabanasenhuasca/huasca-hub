import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePartner, partnerProperty } from '@/lib/partners'
import { createServiceClient } from '@/lib/supabase/service'
import { todayInMexicoStr } from '@/lib/dates'
import StaffCalendar, { type DayInfo } from '@/app/equipo/StaffCalendar'
import { partnerMoveStay, partnerSetBlock, partnerUpdateStayPayment } from '../../../../actions'
import { STAY_COLUMNS, stayLines, type ManualStay } from '@/lib/manual-stays'

export const dynamic = 'force-dynamic'

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export default async function CalendarioSocioPage({ params }: { params: Promise<{ id: string }> }) {
  const partner = await requirePartner()
  const { id } = await params
  const property = await partnerProperty(partner.id, id)
  if (!property) notFound()
  // Otras cabañas del socio, para poder mover una reserva por fuera entre ellas.
  const { data: others } = await createServiceClient()
    .from('properties')
    .select('id, name')
    .eq('partner_id', partner.id)
    .neq('id', id)
    .neq('partner_state', 'removed')
    .order('name')

  const today = todayInMexicoStr()
  const service = createServiceClient()
  const [{ data: blocked }, { data: bookings }, { data: stays }] = await Promise.all([
    service
      .from('blocked_dates')
      .select('date, source, note, blocked_by, booking_id, stay_id, ical_sources(platform, label)')
      .eq('property_id', id)
      .gte('date', today)
      .lt('date', addDays(today, 400)),
    service.from('bookings').select('id, guest_name').eq('property_id', id).eq('status', 'confirmed').gte('check_out', today),
    service.from('manual_stays').select(STAY_COLUMNS).eq('property_id', id).gte('check_out', today),
  ])
  const stayById = new Map(((stays ?? []) as ManualStay[]).map((st) => [st.id, st]))
  const guest = new Map((bookings ?? []).map((b) => [b.id as string, b.guest_name as string]))

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
        label: `Bloqueado${row.blocked_by ? ` por ${row.blocked_by}` : ' por Huasca Retreats'}${row.note ? ` — ${row.note}` : ''}`,
        tag: row.blocked_by ? row.blocked_by.split(' ')[0] : 'HR',
      }
    else if (row.source === 'booking')
      days[row.date] = { kind: 'booking', label: `Reserva — ${guest.get(row.booking_id ?? '') ?? 'huésped'}`, tag: 'Reserva' }
    else days[row.date] = { kind: 'external', label: `Ocupado en ${src?.label ?? src?.platform ?? 'otra plataforma'}` }
  }

  return (
    <div className="space-y-4">
      <Link href={`/socios/cabana/${id}`} className="text-xs text-stone hover:text-navy-deep">← {property.name as string}</Link>
      <div>
        <h1 className="text-xl font-semibold text-navy-deep">Calendario de {property.name as string}</h1>
        <p className="text-sm text-stone mt-1">
          Toca los días para seleccionarlos y elige Bloquear o Desbloquear. Bloquea aquí cada fecha que reserves por fuera (WhatsApp, en
          persona, otra plataforma sin calendario conectado) el mismo día que la reserves. Si es una reserva, marca &quot;Es una reserva&quot; y
          anota los datos del huésped: los verás al tocar el día.
        </p>
      </div>
      <StaffCalendar
        propertyId={id}
        today={today}
        days={days}
        canBlock
        setBlock={partnerSetBlock}
        stayActions={{ updatePayment: partnerUpdateStayPayment, move: partnerMoveStay }}
        moveTargets={(others ?? []).map((o) => ({ id: o.id as string, name: o.name as string }))}
      />
    </div>
  )
}
