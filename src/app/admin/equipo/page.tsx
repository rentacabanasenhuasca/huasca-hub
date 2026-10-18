import { requireHost } from '@/lib/hosts'
import { createServiceClient } from '@/lib/supabase/service'
import StaffManager, { type StaffView } from './StaffManager'

export const dynamic = 'force-dynamic'

export default async function EquipoPage() {
  const host = await requireHost()
  const service = createServiceClient()

  const [{ data: staff }, { data: properties }] = await Promise.all([
    service.from('staff_members').select('*').eq('host_id', host.id).order('created_at', { ascending: true }),
    service.from('properties').select('id, name').eq('host_id', host.id).is('archived_at', null).order('name'),
  ])

  const staffIds = (staff ?? []).map((s) => s.id)
  const { data: access } = staffIds.length
    ? await service.from('staff_property_access').select('staff_id, property_id').in('staff_id', staffIds)
    : { data: [] as { staff_id: string; property_id: string }[] }

  const views: StaffView[] = (staff ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    active: s.active,
    can_block_dates: s.can_block_dates,
    can_view_bookings: s.can_view_bookings,
    can_view_guest_contact: s.can_view_guest_contact,
    property_ids: (access ?? []).filter((a) => a.staff_id === s.id).map((a) => a.property_id),
  }))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-navy-deep">Equipo y colaboradores</h1>
        <p className="text-sm text-stone mt-1">
          Crea usuarios con su propia contraseña para que entren a un panel limitado (huascaretreats.com/equipo) y
          solo vean las propiedades que tú elijas. Tú decides qué pueden hacer en cada caso.
        </p>
      </div>
      <StaffManager staff={views} properties={properties ?? []} />
    </div>
  )
}
