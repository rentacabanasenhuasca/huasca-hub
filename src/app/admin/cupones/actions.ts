'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireHost } from '@/lib/hosts'

type ActionState = { error: string | null }

function buildDiscountPayload(formData: FormData) {
  const discountType = String(formData.get('discount_type') || 'percent') as 'percent' | 'fixed'
  const validFrom = String(formData.get('valid_from') || '').trim()
  const validUntil = String(formData.get('valid_until') || '').trim()
  const minNightsRaw = String(formData.get('min_nights') || '').trim()
  const maxUsesRaw = String(formData.get('max_uses') || '').trim()

  return {
    code: String(formData.get('code') || '').trim().toUpperCase(),
    description: String(formData.get('description') || '').trim() || null,
    discount_type: discountType,
    discount_value: Number(formData.get('discount_value')) || 0,
    valid_from: validFrom || null,
    valid_until: validUntil || null,
    min_nights: minNightsRaw ? Math.max(1, Number(minNightsRaw)) : null,
    max_uses: maxUsesRaw ? Math.max(1, Number(maxUsesRaw)) : null,
    active: formData.get('active') === 'on',
  }
}

// Unidades donde aplica el cupón (vacío = todas las propiedades del host,
// mismo criterio que ya usan los extras).
function parsePropertyIds(formData: FormData): string[] {
  return formData.getAll('property_ids').map(String).filter(Boolean)
}

async function replaceDiscountProperties(
  supabase: Awaited<ReturnType<typeof createClient>>,
  hostId: string,
  discountCodeId: string,
  propertyIds: string[]
) {
  await supabase.from('discount_code_properties').delete().eq('discount_code_id', discountCodeId)
  if (propertyIds.length === 0) return { error: null }

  const { data: owned } = await supabase.from('properties').select('id').eq('host_id', hostId).in('id', propertyIds)
  const ownedIds = new Set((owned ?? []).map((p) => p.id))
  const validIds = propertyIds.filter((id) => ownedIds.has(id))
  if (validIds.length === 0) return { error: null }

  const { error } = await supabase
    .from('discount_code_properties')
    .insert(validIds.map((propertyId) => ({ discount_code_id: discountCodeId, property_id: propertyId })))
  return { error: error ? error.message : null }
}

function validatePayload(payload: ReturnType<typeof buildDiscountPayload>): string | null {
  if (!payload.code) return 'El cupón necesita un código.'
  if (!/^[A-Z0-9_-]+$/.test(payload.code)) return 'El código solo puede tener letras, números, guiones y guion bajo.'
  if (payload.discount_value <= 0) return 'El valor del descuento debe ser mayor a 0.'
  if (payload.discount_type === 'percent' && payload.discount_value > 100) return 'Un descuento en % no puede ser mayor a 100.'
  if (payload.valid_from && payload.valid_until && payload.valid_until < payload.valid_from) {
    return 'La fecha "hasta" no puede ser antes que la fecha "desde".'
  }
  return null
}

export async function createDiscountCode(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const host = await requireHost()
  const supabase = await createClient()

  const payload = buildDiscountPayload(formData)
  const validationError = validatePayload(payload)
  if (validationError) return { error: validationError }

  const { data: discount, error } = await supabase
    .from('discount_codes')
    .insert({ ...payload, host_id: host.id })
    .select('id')
    .single()

  if (error || !discount) {
    if (error?.code === '23505') return { error: `Ya existe un cupón con el código "${payload.code}".` }
    return { error: `No se pudo crear el cupón: ${error?.message ?? 'error desconocido'}` }
  }

  const propResult = await replaceDiscountProperties(supabase, host.id, discount.id, parsePropertyIds(formData))
  if (propResult.error) {
    return { error: `El cupón se creó, pero no se pudieron guardar las unidades: ${propResult.error}` }
  }

  revalidatePath('/admin/cupones')
  return { error: null }
}

export async function updateDiscountCode(
  discountCodeId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const host = await requireHost()
  const supabase = await createClient()

  const payload = buildDiscountPayload(formData)
  const validationError = validatePayload(payload)
  if (validationError) return { error: validationError }

  const { error } = await supabase
    .from('discount_codes')
    .update(payload)
    .eq('id', discountCodeId)
    .eq('host_id', host.id)

  if (error) {
    if (error.code === '23505') return { error: `Ya existe un cupón con el código "${payload.code}".` }
    return { error: `No se pudo guardar: ${error.message}` }
  }

  const propResult = await replaceDiscountProperties(supabase, host.id, discountCodeId, parsePropertyIds(formData))
  if (propResult.error) {
    return { error: `Se guardó el cupón, pero no se pudieron actualizar las unidades: ${propResult.error}` }
  }

  revalidatePath('/admin/cupones')
  return { error: null }
}

export async function deleteDiscountCode(discountCodeId: string) {
  const host = await requireHost()
  const supabase = await createClient()

  await supabase.from('discount_codes').delete().eq('id', discountCodeId).eq('host_id', host.id)

  revalidatePath('/admin/cupones')
}

export async function toggleDiscountActive(discountCodeId: string, active: boolean) {
  const host = await requireHost()
  const supabase = await createClient()

  await supabase.from('discount_codes').update({ active }).eq('id', discountCodeId).eq('host_id', host.id)

  revalidatePath('/admin/cupones')
}
