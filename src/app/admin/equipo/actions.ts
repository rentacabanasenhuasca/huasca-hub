'use server'

// Alta y administración de colaboradores (ver src/lib/staff.ts). Las
// cuentas se crean directo con la API de administración de Supabase Auth
// (service key), con el correo ya confirmado: el anfitrión elige la
// contraseña y se la pasa al colaborador.
import { revalidatePath } from 'next/cache'
import { requireHost } from '@/lib/hosts'
import { createServiceClient } from '@/lib/supabase/service'
import { isUuid } from '@/lib/is-uuid'

type Result = { error: string | null; ok?: boolean }

const EMAIL_RE = /^\S+@\S+\.\S+$/

function readPermissions(formData: FormData) {
  return {
    can_block_dates: formData.get('can_block_dates') === 'on',
    can_view_bookings: formData.get('can_view_bookings') === 'on',
    can_view_guest_contact: formData.get('can_view_guest_contact') === 'on',
  }
}

async function ownPropertyIds(hostId: string, requested: string[]) {
  const ids = requested.filter(isUuid)
  if (ids.length === 0) return []
  const service = createServiceClient()
  const { data } = await service.from('properties').select('id').eq('host_id', hostId).in('id', ids)
  return (data ?? []).map((p) => p.id)
}

async function ownStaff(staffId: string) {
  const host = await requireHost()
  if (!isUuid(staffId)) return null
  const service = createServiceClient()
  const { data } = await service.from('staff_members').select('*').eq('id', staffId).maybeSingle()
  if (!data || data.host_id !== host.id) return null
  return { host, service, staff: data }
}

export async function createStaff(_prev: Result, formData: FormData): Promise<Result> {
  const host = await requireHost()
  const name = String(formData.get('name') || '').trim()
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = String(formData.get('password') || '')
  const propertyIds = await ownPropertyIds(host.id, formData.getAll('property_ids').map(String))

  if (!name) return { error: 'Falta el nombre.' }
  if (!EMAIL_RE.test(email)) return { error: 'El correo no es válido.' }
  if (password.length < 8) return { error: 'La contraseña debe tener al menos 8 caracteres.' }
  if (email === String(host.email ?? '').toLowerCase()) return { error: 'Ese es tu propio correo de anfitrión.' }

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
      error: /already|registered|exists/i.test(msg)
        ? 'Ya existe una cuenta con ese correo.'
        : `No se pudo crear la cuenta: ${msg}`,
    }
  }

  const { data: staff, error } = await service
    .from('staff_members')
    .insert({ host_id: host.id, user_id: created.user.id, name, email, ...readPermissions(formData) })
    .select('id')
    .single()
  if (error || !staff) {
    await service.auth.admin.deleteUser(created.user.id)
    return { error: `No se pudo guardar el colaborador: ${error?.message}` }
  }

  if (propertyIds.length > 0) {
    await service.from('staff_property_access').insert(propertyIds.map((property_id) => ({ staff_id: staff.id, property_id })))
  }

  revalidatePath('/admin/equipo')
  return { error: null, ok: true }
}

export async function updateStaff(staffId: string, _prev: Result, formData: FormData): Promise<Result> {
  const own = await ownStaff(staffId)
  if (!own) return { error: 'No se encontró el colaborador.' }
  const name = String(formData.get('name') || '').trim()
  if (!name) return { error: 'Falta el nombre.' }
  const propertyIds = await ownPropertyIds(own.host.id, formData.getAll('property_ids').map(String))

  const { error } = await own.service
    .from('staff_members')
    .update({ name, ...readPermissions(formData) })
    .eq('id', staffId)
  if (error) return { error: `No se pudo guardar: ${error.message}` }

  await own.service.from('staff_property_access').delete().eq('staff_id', staffId)
  if (propertyIds.length > 0) {
    await own.service.from('staff_property_access').insert(propertyIds.map((property_id) => ({ staff_id: staffId, property_id })))
  }

  revalidatePath('/admin/equipo')
  return { error: null, ok: true }
}

export async function resetStaffPassword(staffId: string, password: string): Promise<Result> {
  const own = await ownStaff(staffId)
  if (!own) return { error: 'No se encontró el colaborador.' }
  if (password.length < 8) return { error: 'La contraseña debe tener al menos 8 caracteres.' }
  const { error } = await own.service.auth.admin.updateUserById(own.staff.user_id, { password })
  if (error) return { error: `No se pudo cambiar la contraseña: ${error.message}` }
  return { error: null, ok: true }
}

export async function setStaffActive(staffId: string, active: boolean): Promise<Result> {
  const own = await ownStaff(staffId)
  if (!own) return { error: 'No se encontró el colaborador.' }
  // Desactivado = no puede iniciar sesión (y su sesión abierta deja de
  // servir en /equipo), pero se conserva para reactivarlo después.
  const { error: banError } = await own.service.auth.admin.updateUserById(own.staff.user_id, {
    ban_duration: active ? 'none' : '876000h',
  })
  if (banError) return { error: `No se pudo actualizar el acceso: ${banError.message}` }
  await own.service.from('staff_members').update({ active }).eq('id', staffId)
  revalidatePath('/admin/equipo')
  return { error: null, ok: true }
}

export async function deleteStaff(staffId: string): Promise<Result> {
  const own = await ownStaff(staffId)
  if (!own) return { error: 'No se encontró el colaborador.' }
  // Borrar la cuenta de Auth borra en cascada su fila y sus accesos. Los
  // bloqueos de fechas que haya hecho se quedan (son del calendario).
  const { error } = await own.service.auth.admin.deleteUser(own.staff.user_id)
  if (error) return { error: `No se pudo eliminar: ${error.message}` }
  revalidatePath('/admin/equipo')
  return { error: null, ok: true }
}
