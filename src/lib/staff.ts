// Colaboradores: personas a las que el anfitrión les da acceso limitado
// (por ejemplo, el dueño de una cabaña o quien la limpia) para que puedan
// bloquear fechas de SOLO las propiedades que el anfitrión elija, desde su
// propio panel en /equipo. Los crea el anfitrión en /admin/equipo, con
// correo y contraseña.
//
// Las tablas staff_members / staff_property_access no tienen políticas de
// RLS: todo pasa por el servidor con la service key, y aquí es donde se
// revisa quién es y a qué tiene acceso.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export type StaffMember = {
  id: string
  host_id: string
  user_id: string
  name: string
  email: string
  can_block_dates: boolean
  can_view_bookings: boolean
  can_view_guest_contact: boolean
  // Puede crear usuarios para su propia gente (limpieza, encargado), solo
  // en sus propiedades y con permisos iguales o menores a los suyos.
  can_manage_team: boolean
  // Si lo creó otro colaborador o un socio (en vez del anfitrión).
  created_by_staff_id: string | null
  created_by_partner_id: string | null
  active: boolean
}

export type StaffContext = StaffMember & {
  properties: { id: string; name: string; slug: string }[]
}

/** Si el usuario es colaborador, regresa su fila (activa o no). */
export async function findStaffByUserId(userId: string) {
  const service = createServiceClient()
  const { data } = await service.from('staff_members').select('*').eq('user_id', userId).maybeSingle()
  return (data as StaffMember | null) ?? null
}

/**
 * Para las páginas de /equipo: exige sesión de un colaborador activo y
 * regresa sus datos con las propiedades a las que tiene acceso.
 */
export async function requireStaff(): Promise<StaffContext> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/equipo')

  const staff = await findStaffByUserId(user.id)
  if (!staff) redirect('/admin')
  if (!staff.active) {
    await supabase.auth.signOut()
    redirect('/login?desactivado=1')
  }

  const service = createServiceClient()
  const { data: access } = await service
    .from('staff_property_access')
    .select('properties(id, name, slug)')
    .eq('staff_id', staff.id)
  const properties = (access ?? [])
    .map((a) => (Array.isArray(a.properties) ? a.properties[0] : a.properties) as { id: string; name: string; slug: string } | null)
    .filter((p): p is { id: string; name: string; slug: string } => Boolean(p))
    .sort((a, b) => a.name.localeCompare(b.name))

  return { ...staff, properties }
}

/**
 * Grupo al que pertenece un colaborador, para decidir qué datos de huéspedes
 * (manual_stays.owner_key) puede ver: el suyo y el de su "jefe".
 */
export function staffOwnerKey(staff: Pick<StaffMember, 'id' | 'created_by_staff_id' | 'created_by_partner_id'>) {
  if (staff.created_by_partner_id) return `partner:${staff.created_by_partner_id}`
  return `staff:${staff.created_by_staff_id ?? staff.id}`
}
