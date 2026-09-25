// Resuelve los extras seleccionados por el huésped en el checkout contra el
// catálogo real en la base de datos — el navegador solo manda
// {addonId, quantity}, nunca un precio ni un subtotal, así que aquí se
// vuelve a leer el precio verdadero y se recalcula todo (mismo criterio que
// getBookingQuote() ya usa para el precio de la estancia: nunca confiar en
// un total que venga del cliente).
import type { SupabaseClient } from '@supabase/supabase-js'

export type AddonSelection = { addonId: string; quantity: number }

export type ResolvedAddonItem = {
  addon_id: string
  name: string
  unit_price_mxn: number
  quantity: number
  subtotal_mxn: number
}

export type ResolvedAddons = {
  items: ResolvedAddonItem[]
  total: number
}

export async function resolveAddons(
  supabase: SupabaseClient,
  hostId: string,
  propertyId: string,
  selections: AddonSelection[]
): Promise<ResolvedAddons> {
  if (!selections || selections.length === 0) return { items: [], total: 0 }

  const ids = [...new Set(selections.map((s) => s.addonId).filter(Boolean))]
  if (ids.length === 0) return { items: [], total: 0 }

  const [{ data: addons }, { data: restrictions }] = await Promise.all([
    supabase
      .from('addons')
      .select('id, name, price_mxn, unit, max_quantity')
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
  for (const sel of selections) {
    const addon = byId.get(sel.addonId)
    if (!addon) continue // Extra ya no existe o se desactivó — se ignora, no se cobra.

    const quantity =
      addon.unit === 'per_unit'
        ? Math.min(Math.max(1, Math.round(sel.quantity || 1)), addon.max_quantity)
        : 1

    const unitPrice = Number(addon.price_mxn)
    items.push({
      addon_id: addon.id,
      name: addon.name,
      unit_price_mxn: unitPrice,
      quantity,
      subtotal_mxn: Math.round(unitPrice * quantity * 100) / 100,
    })
  }

  const total = items.reduce((sum, it) => sum + it.subtotal_mxn, 0)
  return { items, total: Math.round(total * 100) / 100 }
}
