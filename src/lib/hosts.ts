import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { findStaffByUserId } from '@/lib/staff'

/**
 * Devuelve la fila de `hosts` del usuario autenticado, creándola si es la
 * primera vez que entra (single-tenant: solo existirá Christian/Huasca
 * Retreats, pero cualquier usuario que se registre obtiene su propio host).
 * Si no hay sesión, redirige a /login.
 */
export async function requireHost() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: existing } = await supabase
    .from('hosts')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    return existing
  }

  // Un colaborador (ver src/lib/staff.ts) no es anfitrión: no se le crea
  // un perfil de anfitrión, su panel es /equipo.
  if (await findStaffByUserId(user.id)) redirect('/equipo')

  const name = (user.user_metadata?.name as string | undefined) || user.email || 'Anfitrión'

  const { data: created, error } = await supabase
    .from('hosts')
    .insert({ user_id: user.id, name, email: user.email! })
    .select('*')
    .single()

  if (error || !created) {
    throw new Error(`No se pudo crear el perfil de anfitrión: ${error?.message}`)
  }

  return created
}
