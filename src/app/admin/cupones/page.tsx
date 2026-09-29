import { createClient } from '@/lib/supabase/server'
import { requireHost } from '@/lib/hosts'
import CuponesManager from './CuponesManager'

export default async function CuponesPage() {
  const host = await requireHost()
  const supabase = await createClient()

  const { data: discounts } = await supabase
    .from('discount_codes')
    .select(
      'id, code, description, discount_type, discount_value, valid_from, valid_until, min_nights, max_uses, times_used, active'
    )
    .eq('host_id', host.id)
    .order('created_at', { ascending: false })

  const { data: properties } = await supabase
    .from('properties')
    .select('id, name')
    .eq('host_id', host.id)
    .order('name')

  const discountIds = (discounts ?? []).map((d) => d.id)
  const { data: discountProps } =
    discountIds.length > 0
      ? await supabase.from('discount_code_properties').select('discount_code_id, property_id').in('discount_code_id', discountIds)
      : { data: [] }

  const propertyIdsByDiscount = new Map<string, string[]>()
  for (const row of discountProps ?? []) {
    const list = propertyIdsByDiscount.get(row.discount_code_id) ?? []
    list.push(row.property_id)
    propertyIdsByDiscount.set(row.discount_code_id, list)
  }

  const discountsWithProperties = (discounts ?? []).map((d) => ({
    ...d,
    property_ids: propertyIdsByDiscount.get(d.id) ?? [],
  }))

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-navy-deep">Cupones y descuentos</h1>
        <p className="text-sm text-stone mt-1">
          Códigos de descuento que tus huéspedes pueden usar al reservar. Elige % o monto fijo, fechas de
          vigencia, mínimo de noches, límite de usos y en qué cabañas aplica.
        </p>
      </div>
      <CuponesManager discounts={discountsWithProperties} properties={properties ?? []} />
    </div>
  )
}
