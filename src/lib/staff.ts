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
