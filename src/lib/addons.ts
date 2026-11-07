// Resuelve los extras seleccionados por el huésped en el checkout contra el
// catálogo real en la base de datos — el navegador solo manda
// {addonId, quantity}, nunca un precio ni un subtotal, así que aquí se
// vuelve a leer el precio verdadero y se recalcula todo (mismo criterio que
// getBookingQuote() ya usa para el precio de la estancia: nunca confiar en
// un total que venga del cliente).
import type { SupabaseClient } from '@supabase/supabase-js'
import { todayInMexicoStr } from '@/lib/dates'

// Los extras solo se ofrecen si la llegada es con al menos esta anticipación
// (en días): con menos tiempo no alcanza a prepararse (kit, decoración, etc.).
export const ADDONS_MIN_DAYS_AHEAD = 2

export function addonsAvailableFor(checkin: string): boolean {
  const today = todayInMexicoStr()
  const days = Math.round((Date.parse(`${checkin}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000)
  return days >= ADDONS_MIN_DAYS_AHEAD
}

export type AddonQuestion = {
  key: string
  label: string
  type: 'text' | 'select'
  required?: boolean
  maxLength?: number
  placeholder?: string
  options?: string[]
}

// Respuestas del huésped a las preguntas de un extra (ej. mensaje del
// letrero, sabor de pizza), por key de la pregunta.
export type AddonSelection = { addonId: string; quantity: number; answers?: Record<string, string> }

export type AddonAnswer = { label: string; value: string }

// Limpia las respuestas contra las preguntas reales del extra: solo las
// preguntas que existen, texto recortado, y en las de opciones solo un valor
// de la lista. Devuelve también qué preguntas obligatorias faltan.
export function cleanAddonAnswers(questions: AddonQuestion[] | null | undefined, raw: Record<string, string> | undefined) {
  const answers: AddonAnswer[] = []
  const missing: string[] = []
  for (const q of questions ?? []) {
    let value = String(raw?.[q.key] ?? '').trim().slice(0, q.maxLength ?? 200)
    if (q.type === 'select' && value && !(q.options ?? []).includes(value)) value = ''
    if (value) answers.push({ label: q.label, value })
    else if (q.required) missing.push(q.label)
  }
  return { answers, missing }
}

export type ResolvedAddonItem = {
  addon_id: string
  name: string
  unit_price_mxn: number
  quantity: number
  subtotal_mxn: number
  answers: AddonAnswer[]
}

export type ResolvedAddons = {
  items: ResolvedAddonItem[]
  total: number
  // Preguntas obligatorias sin contestar, por extra (ej. "Decoración: Sabor de tu pizza").
  missing: string[]
}

export async function resolveAddons(
  supabase: SupabaseClient,
  hostId: string,
  propertyId: string,
  selections: AddonSelection[],
  // Si se pasa, no se cobra ningún extra cuando la llegada es con menos de
  // ADDONS_MIN_DAYS_AHEAD días de anticipación (ver addonsAvailableFor).
  options?: { checkin?: string }
): Promise<ResolvedAddons> {
  if (!selections || selections.length === 0) return { items: [], total: 0, missing: [] }
  if (options?.checkin && !addonsAvailableFor(options.checkin)) return { items: [], total: 0, missing: [] }

  const ids = [...new Set(selections.map((s) => s.addonId).filter(Boolean))]
  if (ids.length === 0) return { items: [], total: 0, missing: [] }

  const [{ data: addons }, { data: restrictions }] = await Promise.all([
    supabase
      .from('addons')
      .select('id, name, price_mxn, unit, max_quantity, min_quantity, questions')
      .eq('host_id', hostId)
      .eq('active', true)
      .in('id', ids),
    // Si un addon tiene filas aquí, solo aplica a esas propiedades — si no
    // tiene ninguna, aplica a todas (mismo criterio que en el checkout).
    supabase.from('addon_properties').select('addon_id, property_id').in('addon_id', ids),
  ])

  const restrictedTo = new Map<string, Set<string>>()
  for (const r of restrictions ?? []) {
    if (!restrictedTo.has(r.addon_id)) restrictedTo.set(r.addon_id, new Set())
    restrictedTo.get(r.addon_id)!.add(r.property_id)
  }

  const byId = new Map(
    (addons ?? [])
      // Nunca confiar en que el navegador solo mandó extras válidos para
      // esta cabaña — si el addon está restringido a ciertas propiedades y
      // esta no es una de ellas, se ignora como si no existiera.
      .filter((a) => {
        const allowed = restrictedTo.get(a.id)
        return !allowed || allowed.has(propertyId)
      })
      .map((a) => [a.id, a])
  )

  const items: ResolvedAddonItem[] = []
  const missing: string[] = []
  for (const sel of selections) {
    const addon = byId.get(sel.addonId)
    if (!addon) continue // Extra ya no existe o se desactivó — se ignora, no se cobra.

    const quantity =
      addon.unit === 'per_unit'
        ? Math.min(Math.max(addon.min_quantity ?? 1, Math.round(sel.quantity || 1)), addon.max_quantity)
        : 1

    const unitPrice = Number(addon.price_mxn)
    const cleaned = cleanAddonAnswers(addon.questions as AddonQuestion[] | null, sel.answers)
    for (const m of cleaned.missing) missing.push(`${addon.name}: ${m}`)
    items.push({
      addon_id: addon.id,
      name: addon.name,
      unit_price_mxn: unitPrice,
      quantity,
      subtotal_mxn: Math.round(unitPrice * quantity * 100) / 100,
      answers: cleaned.answers,
    })
  }

  const total = items.reduce((sum, it) => sum + it.subtotal_mxn, 0)
  return { items, total: Math.round(total * 100) / 100, missing }
}
