'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireHost } from '@/lib/hosts'
import { recomputeCalendarRange } from '@/lib/calendar'

type ActionState = { error: string | null }

function num(formData: FormData, field: string): number | null {
  const raw = formData.get(field)
  if (raw === null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

const DAY_KEYS = ['0', '1', '2', '3', '4', '5', '6']
function parseDaysOrNull(formData: FormData, field: string) {
  const selected = DAY_KEYS.filter((d) => formData.get(`${field}_${d}`) === 'on').map(Number)
  return selected.length > 0 && selected.length < 7 ? selected : null
}

function buildRulePayload(formData: FormData) {
  const priceOverride = num(formData, 'price_override_mxn')
  const priceAdjustment = num(formData, 'price_adjustment_pct')

  return {
    name: String(formData.get('name') || '').trim(),
    min_nights: num(formData, 'min_nights'),
    max_nights: num(formData, 'max_nights'),
    // Solo uno de los dos aplica: si viene precio fijo, ignora el %.
    price_override_mxn: priceOverride,
    price_adjustment_pct: priceOverride != null ? null : priceAdjustment,
    extra_guest_fee_mxn: num(formData, 'extra_guest_fee_mxn'),
    allowed_arrival_days: parseDaysOrNull(formData, 'arrival'),
    priority: num(formData, 'priority') ?? 0,
    color: String(formData.get('color') || '#c9a24a'),
  }
}

export async function createRule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const host = await requireHost()
  const supabase = await createClient()

  const payload = buildRulePayload(formData)
  if (!payload.name) return { error: 'La regla necesita un nombre.' }

  const { data: rule, error } = await supabase
    .from('pricing_rules')
    .insert({ ...payload, host_id: host.id })
    .select('id')
    .single()
  if (error || !rule) return { error: `No se pudo crear la regla: ${error?.message ?? 'error desconocido'}` }

  // Si desde el formulario se eligieron unidades + fechas, aplicamos la
  // regla recién creada de una vez a esas cabañas y ese rango — así no hay
  // que ir aparte al calendario a seleccionar celda por celda.
  const propertyIds = formData.getAll('property_ids').map(String).filter(Boolean)
  const applyStart = String(formData.get('apply_start') || '')
  const applyEnd = String(formData.get('apply_end') || '')

  if (propertyIds.length > 0 && applyStart && applyEnd) {
    if (applyEnd < applyStart) {
      return { error: 'La regla se creó, pero "Hasta" no puede ser antes que "Desde" — aplícala desde el calendario.' }
    }
    // Verifica que las propiedades sean del host antes de aplicar nada.
    const { data: owned } = await supabase.from('properties').select('id').eq('host_id', host.id).in('id', propertyIds)
    const ownedIds = new Set((owned ?? []).map((p) => p.id))
    const validIds = propertyIds.filter((id) => ownedIds.has(id))

    if (validIds.length > 0) {
      const rows = validIds.map((propertyId) => ({
        rule_id: rule.id,
        property_id: propertyId,
        start_date: applyStart,
        end_date: applyEnd,
      }))
      const { error: applyError } = await supabase.from('rule_applications').insert(rows)
      if (applyError) {
        return { error: `La regla se creó, pero no se pudo aplicar a las fechas: ${applyError.message}` }
      }
      await recomputeCalendarRange(supabase, validIds, applyStart, applyEnd)
    }
  }

  revalidatePath('/admin/reglas')
  revalidatePath('/admin/calendario')
  return { error: null }
}

export async function updateRule(
  ruleId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const host = await requireHost()
  const supabase = await createClient()

  const payload = buildRulePayload(formData)
  if (!payload.name) return { error: 'La regla necesita un nombre.' }

  const { error } = await supabase
    .from('pricing_rules')
    .update(payload)
    .eq('id', ruleId)
    .eq('host_id', host.id)

  if (error) return { error: `No se pudo guardar: ${error.message}` }

  // La edición de la regla puede cambiar precios ya calculados: recalcula
  // todo el rango donde esta regla está aplicada.
  const { data: apps } = await supabase
    .from('rule_applications')
    .select('property_id, start_date, end_date')
    .eq('rule_id', ruleId)

  if (apps && apps.length > 0) {
    const propertyIds = [...new Set(apps.map((a) => a.property_id))]
    const start = apps.reduce((min, a) => (a.start_date < min ? a.start_date : min), apps[0].start_date)
    const end = apps.reduce((max, a) => (a.end_date > max ? a.end_date : max), apps[0].end_date)
    await recomputeCalendarRange(supabase, propertyIds, start, end)
  }

  revalidatePath('/admin/reglas')
  revalidatePath('/admin/calendario')
  return { error: null }
}

export async function deleteRule(ruleId: string) {
  const host = await requireHost()
  const supabase = await createClient()

  const { data: apps } = await supabase
    .from('rule_applications')
    .select('property_id, start_date, end_date')
    .eq('rule_id', ruleId)

  await supabase.from('pricing_rules').delete().eq('id', ruleId).eq('host_id', host.id)

  if (apps && apps.length > 0) {
    const propertyIds = [...new Set(apps.map((a) => a.property_id))]
    const start = apps.reduce((min, a) => (a.start_date < min ? a.start_date : min), apps[0].start_date)
    const end = apps.reduce((max, a) => (a.end_date > max ? a.end_date : max), apps[0].end_date)
    await recomputeCalendarRange(supabase, propertyIds, start, end)
  }

  revalidatePath('/admin/reglas')
  revalidatePath('/admin/calendario')
}
