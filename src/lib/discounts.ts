// Validación y cálculo de códigos de descuento — misma filosofía que
// booking-quote.ts y addons.ts: el navegador solo manda el código que
// escribió el huésped, el monto real del descuento SIEMPRE se calcula aquí
// contra la base de datos, tanto al mostrar el total en el checkout como al
// cobrar de verdad.
import type { SupabaseClient } from '@supabase/supabase-js'

export type DiscountCodeRow = {
  id: string
  code: string
  description: string | null
  discount_type: 'percent' | 'fixed'
  discount_value: number
  valid_from: string | null
  valid_until: string | null
  min_nights: number | null
  max_uses: number | null
  times_used: number
  active: boolean
}

export type DiscountResult =
  | {
      valid: true
      discountCodeId: string
      code: string
      description: string | null
      discountAmount: number
    }
  | { valid: false; error: string }

/**
 * Valida un código para una reserva concreta (propiedad, fechas, número de
 * noches, subtotal antes de descuento) y devuelve cuánto se debe
 * descontar. No incrementa el contador de usos — eso solo pasa cuando la
 * reserva se confirma de verdad (ver applyDiscountUsage más abajo),
 * llamado desde booking-finalize.ts.
 */
export async function resolveDiscountCode(
  supabase: SupabaseClient,
  hostId: string,
  propertyId: string,
  checkin: string,
  nights: number,
  subtotal: number,
  rawCode: string
): Promise<DiscountResult> {
  const code = rawCode.trim().toUpperCase()
  if (!code) return { valid: false, error: 'Escribe un código.' }

  const { data: discount } = await supabase
    .from('discount_codes')
    .select('id, code, description, discount_type, discount_value, valid_from, valid_until, min_nights, max_uses, times_used, active')
    .eq('host_id', hostId)
    .ilike('code', code)
    .maybeSingle()

  if (!discount || !discount.active) {
    return { valid: false, error: 'Ese código no existe o ya no está activo.' }
  }

  if (discount.valid_from && checkin < discount.valid_from) {
    return { valid: false, error: 'Ese código todavía no está vigente para esas fechas.' }
  }
  if (discount.valid_until && checkin > discount.valid_until) {
    return { valid: false, error: 'Ese código ya venció.' }
  }
  if (discount.min_nights && nights < discount.min_nights) {
    return { valid: false, error: `Ese código requiere mínimo ${discount.min_nights} noches.` }
  }
  if (discount.max_uses != null && discount.times_used >= discount.max_uses) {
    return { valid: false, error: 'Ese código ya alcanzó su límite de usos.' }
  }

  // Restricción por unidad: sin filas en discount_code_properties = aplica
  // a todas las cabañas del host (mismo criterio que addon_properties).
  const { data: restrictions } = await supabase
    .from('discount_code_properties')
    .select('property_id')
    .eq('discount_code_id', discount.id)

  if (restrictions && restrictions.length > 0) {
    const allowed = new Set(restrictions.map((r) => r.property_id))
    if (!allowed.has(propertyId)) {
      return { valid: false, error: 'Ese código no aplica para esta cabaña.' }
    }
  }

  const discountAmount =
    discount.discount_type === 'percent'
      ? Math.round((subtotal * Number(discount.discount_value)) / 100 * 100) / 100
      : Math.min(Number(discount.discount_value), subtotal)

  if (discountAmount <= 0) {
    return { valid: false, error: 'Ese código no aplica a este total.' }
  }

  return {
    valid: true,
    discountCodeId: discount.id,
    code: discount.code,
    description: discount.description,
    discountAmount,
  }
}

/**
 * Se llama SOLO cuando la reserva ya quedó confirmada (dentro de
 * finalizeBooking) — incrementa el contador de usos del código. Mejor
 * esfuerzo: si falla, no se revierte la reserva ni el cobro ya hecho, solo
 * se pierde exactitud en el contador (mismo criterio que los correos de
 * confirmación).
 */
export async function applyDiscountUsage(supabase: SupabaseClient, discountCodeId: string) {
  const { data } = await supabase.from('discount_codes').select('times_used').eq('id', discountCodeId).maybeSingle()
  if (!data) return
  await supabase
    .from('discount_codes')
    .update({ times_used: data.times_used + 1 })
    .eq('id', discountCodeId)
}
