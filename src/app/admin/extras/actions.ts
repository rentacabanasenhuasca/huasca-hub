'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireHost } from '@/lib/hosts'

type ActionState = { error: string | null }

function buildAddonPayload(formData: FormData) {
  const unit = String(formData.get('unit') || 'flat') as 'flat' | 'per_unit'
  const maxQuantityRaw = formData.get('max_quantity')
  const maxQuantity = unit === 'per_unit' ? Math.max(1, Number(maxQuantityRaw) || 1) : 1

  return {
    name: String(formData.get('name') || '').trim(),
    description: String(formData.get('description') || '').trim() || null,
    price_mxn: Number(formData.get('price_mxn')) || 0,
    unit,
    max_quantity: maxQuantity,
    photo_url: String(formData.get('photo_url') || '').trim() || null,
    active: formData.get('active') === 'on',
    sort_order: Number(formData.get('sort_order')) || 0,
  }
}

// Unidades donde aplica el extra (vacío = todas las propiedades del host,
// mismo criterio que rule_applications ya usa para las reglas de precio).
function parsePropertyIds(formData: FormData): string[] {
  return formData.getAll('property_ids').map(String).filter(Boolean)
}

async function replaceAddonProperties(
  supabase: Awaited<ReturnType<typeof createClient>>,
  hostId: string,
  addonId: string,
  propertyIds: string[]
) {
  await supabase.from('addon_properties').delete().eq('addon_id', addonId)
  if (propertyIds.length === 0) return { error: null }

  // Verifica que las propiedades sean del host antes de restringir a ellas.
  const { data: owned } = await supabase.from('properties').select('id').eq('host_id', hostId).in('id', propertyIds)
  const ownedIds = new Set((owned ?? []).map((p) => p.id))
  const validIds = propertyIds.filter((id) => ownedIds.has(id))
  if (validIds.length === 0) return { error: null }

  const { error } = await supabase
    .from('addon_properties')
    .insert(validIds.map((propertyId) => ({ addon_id: addonId, property_id: propertyId })))
  return { error: error ? error.message : null }
}

export async function createAddon(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const host = await requireHost()
  const supabase = await createClient()

  const payload = buildAddonPayload(formData)
  if (!payload.name) return { error: 'El extra necesita un nombre.' }
  if (payload.price_mxn < 0) return { error: 'El precio no puede ser negativo.' }

  const { data: addon, error } = await supabase
    .from('addons')
    .insert({ ...payload, host_id: host.id })
    .select('id')
    .single()
  if (error || !addon) return { error: `No se pudo crear el extra: ${error?.message ?? 'error desconocido'}` }

  const propResult = await replaceAddonProperties(supabase, host.id, addon.id, parsePropertyIds(formData))
  if (propResult.error) {
    return { error: `El extra se creó, pero no se pudieron guardar las unidades: ${propResult.error}` }
  }

  revalidatePath('/admin/extras')
  return { error: null }
}

export async function updateAddon(
  addonId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const host = await requireHost()
  const supabase = await createClient()

  const payload = buildAddonPayload(formData)
  if (!payload.name) return { error: 'El extra necesita un nombre.' }
  if (payload.price_mxn < 0) return { error: 'El precio no puede ser negativo.' }

  const { error } = await supabase
    .from('addons')
    .update(payload)
    .eq('id', addonId)
    .eq('host_id', host.id)

  if (error) return { error: `No se pudo guardar: ${error.message}` }

  const propResult = await replaceAddonProperties(supabase, host.id, addonId, parsePropertyIds(formData))
  if (propResult.error) {
    return { error: `Se guardó el extra, pero no se pudieron actualizar las unidades: ${propResult.error}` }
  }

  revalidatePath('/admin/extras')
  return { error: null }
}

export async function deleteAddon(addonId: string) {
  const host = await requireHost()
  const supabase = await createClient()

  await supabase.from('addons').delete().eq('id', addonId).eq('host_id', host.id)

  revalidatePath('/admin/extras')
}

export async function toggleAddonActive(addonId: string, active: boolean) {
  const host = await requireHost()
  const supabase = await createClient()

  await supabase.from('addons').update({ active }).eq('id', addonId).eq('host_id', host.id)

  revalidatePath('/admin/extras')
}
