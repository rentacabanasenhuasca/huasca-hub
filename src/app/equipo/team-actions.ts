'use server'

// "Mi equipo": un colaborador con permiso de manejar equipo (ej. Angie, Alma)
// o un socio pueden darle acceso a su propia gente (quien limpia, el
// encargado…) para que vea y bloquee el calendario de SUS cabañas en
// huascaretreats.com/equipo.
//
// Reglas:
//   - Solo pueden dar acceso a sus propias cabañas.
//   - Los permisos de su gente nunca pueden ser mayores a los suyos.
//   - Su gente no puede, a su vez, crear más usuarios.
//   - El anfitrión ve y puede editar a todos en Admin → Equipo.
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { isUuid } from '@/lib/is-uuid'
import { currentTeamOwner, ownerColumn, type TeamOwner } from '@/lib/team'

type Result = { error: string | null; ok?: boolean }

const EMAIL_RE = /^\S+@\S+\.\S+$/

function readPermissions(owner: TeamOwner, formData: FormData) {
  const viewBookings = owner.perms.can_view_bookings && formData.get('can_view_bookings') === 'on'
  return {
    can_block_dates: owner.perms.can_block_dates && formData.get('can_block_dates') === 'on',
    can_view_bookings: viewBookings,
    can_view_guest_contact: viewBookings && owner.perms.can_view_guest_contact && formData.get('can_view_guest_contact') === 'on',
  }
}

function allowedProperties(owner: TeamOwner, formData: FormData) {
  const mine = new Set(owner.properties.map((p) => p.id))
  return [...new Set(formData.getAll('property_ids').map(String))].filter((id) => isUuid(id) && mine.has(id))
}

async function ownMember(memberId: string) {
  const owner = await currentTeamOwner()
  if (!owner || !isUuid(memberId)) return null
  const service = createServiceClient()
  const { data } = await service.from('staff_members').select('*').eq('id', memberId).eq(ownerColumn(owner), owner.id).maybeSingle()
  if (!data) return null
  return { owner, service, member: data }
}

function revalidate() {
  revalidatePath('/equipo/mi-equipo')
  revalidatePath('/socios/equipo')
  revalidatePath('/admin/equipo')
}

export async function createTeamMember(_prev: Result, formData: FormData): Promise<Result> {
  const owner = await currentTeamOwner()
  if (!owner) return { error: 'No tienes permiso para dar acceso a otras personas.' }
  if (!owner.hostId || owner.properties.length === 0) return { error: 'Primero necesitas tener al menos una cabaña.' }

  const name = String(formData.get('name') || '').trim()
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = String(formData.get('password') || '')
  const propertyIds = allowedProperties(owner, formData)
  if (!name) return { error: 'Falta el nombre.' }
  if (!EMAIL_RE.test(email)) return { error: 'El correo no es válido.' }
  if (password.length < 8) return { error: 'La contraseña debe tener al menos 8 caracteres.' }
  if (propertyIds.length === 0) return { error: 'Elige al menos una cabaña.' }

  const service = createServiceClient()
  const { data: created, error: authError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: 'staff' },
  })
  if (authError || !created?.user) {
    const msg = authError?.message ?? ''
    return {
      error: /already|registered|exists/i.test(msg) ? 'Ya existe una cuenta con ese correo.' : `No se pudo crear la cuenta: ${msg}`,
    }
  }

  const { data: member, error } = await service
    .from('staff_members')
    .insert({
      host_id: owner.hostId,
      user_id: created.user.id,
      name,
      email,
      ...readPermissions(owner, formData),
      can_manage_team: false,
      [ownerColumn(owner)]: owner.id,
    })
    .select('id')
    .single()
  if (error || !member) {
    await service.auth.admin.deleteUser(created.user.id)
    return { error: `No se pudo guardar: ${error?.message}` }
  }
  await service.from('staff_property_access').insert(propertyIds.map((property_id) => ({ staff_id: member.id, property_id })))

  revalidate()
  return { error: null, ok: true }
}

export async function updateTeamMember(memberId: string, _prev: Result, formData: FormData): Promise<Result> {
  const own = await ownMember(memberId)
  if (!own) return { error: 'No se encontró a esa persona en tu equipo.' }
  const name = String(formData.get('name') || '').trim()
  if (!name) return { error: 'Falta el nombre.' }
  const propertyIds = allowedProperties(own.owner, formData)
  if (propertyIds.length === 0) return { error: 'Elige al menos una cabaña.' }

  const { error } = await own.service
    .from('staff_members')
    .update({ name, ...readPermissions(own.owner, formData) })
    .eq('id', memberId)
  if (error) return { error: `No se pudo guardar: ${error.message}` }
  // Solo se tocan los accesos a cabañas de quien maneja el equipo.
  await own.service
    .from('staff_property_access')
    .delete()
    .eq('staff_id', memberId)
    .in('property_id', own.owner.properties.map((p) => p.id))
  await own.service.from('staff_property_access').insert(propertyIds.map((property_id) => ({ staff_id: memberId, property_id })))
  revalidate()
  return { error: null, ok: true }
}

export async function resetTeamMemberPassword(memberId: string, password: string): Promise<Result> {
  const own = await ownMember(memberId)
  if (!own) return { error: 'No se encontró a esa persona en tu equipo.' }
  if (password.length < 8) return { error: 'La contraseña debe tener al menos 8 caracteres.' }
  const { error } = await own.service.auth.admin.updateUserById(own.member.user_id, { password })
  if (error) return { error: `No se pudo cambiar la contraseña: ${error.message}` }
  return { error: null, ok: true }
}

export async function setTeamMemberActive(memberId: string, active: boolean): Promise<Result> {
  const own = await ownMember(memberId)
  if (!own) return { error: 'No se encontró a esa persona en tu equipo.' }
  const { error } = await own.service.auth.admin.updateUserById(own.member.user_id, { ban_duration: active ? 'none' : '876000h' })
  if (error) return { error: `No se pudo actualizar el acceso: ${error.message}` }
  await own.service.from('staff_members').update({ active }).eq('id', memberId)
  revalidate()
  return { error: null, ok: true }
}

export async function deleteTeamMember(memberId: string): Promise<Result> {
  const own = await ownMember(memberId)
  if (!own) return { error: 'No se encontró a esa persona en tu equipo.' }
  const { error } = await own.service.auth.admin.deleteUser(own.member.user_id)
  if (error) return { error: `No se pudo eliminar: ${error.message}` }
  revalidate()
  return { error: null, ok: true }
}
