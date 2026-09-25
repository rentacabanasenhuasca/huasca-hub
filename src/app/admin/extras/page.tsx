import { createClient } from '@/lib/supabase/server'
import { requireHost } from '@/lib/hosts'
import ExtrasManager from './ExtrasManager'

export default async function ExtrasPage() {
  const host = await requireHost()
  const supabase = await createClient()

  const { data: addons } = await supabase
    .from('addons')
    .select('id, name, description, price_mxn, unit, max_quantity, photo_url, active, sort_order')
    .eq('host_id', host.id)
    .order('sort_order', { ascending: true })

  const { data: properties } = await supabase
    .from('properties')
    .select('id, name')
    .eq('host_id', host.id)
    .order('name')

  const addonIds = (addons ?? []).map((a) => a.id)
  const { data: addonProps } =
    addonIds.length > 0
      ? await supabase.from('addon_properties').select('addon_id, property_id').in('addon_id', addonIds)
      : { data: [] }

  const propertyIdsByAddon = new Map<string, string[]>()
  for (const row of addonProps ?? []) {
    const list = propertyIdsByAddon.get(row.addon_id) ?? []
    list.push(row.property_id)
    propertyIdsByAddon.set(row.addon_id, list)
  }

  const addonsWithProperties = (addons ?? []).map((a) => ({
    ...a,
    property_ids: propertyIdsByAddon.get(a.id) ?? [],
  }))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-navy-deep">Extras / add-ons</h1>
        <p className="text-sm text-stone mt-1">
          Servicios y actividades opcionales que tus huéspedes pueden agregar al reservar (early
          check-in, jacuzzi, kits, tours…). Por defecto se ofrecen en todas tus cabañas, a menos
          que elijas unidades específicas.
        </p>
      </div>
      <ExtrasManager addons={addonsWithProperties} properties={properties ?? []} />
    </div>
  )
}
