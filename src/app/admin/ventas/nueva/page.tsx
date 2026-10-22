import { createClient } from '@/lib/supabase/server'
import { requireHost } from '@/lib/hosts'
import SaleListingForm from '../SaleListingForm'
import { createSaleListing } from '../actions'

export default async function NuevaVentaPage() {
  const host = await requireHost()
  const supabase = await createClient()
  const { data: properties } = await supabase
    .from('properties')
    .select('id, name')
    .eq('host_id', host.id)
    .is('archived_at', null)
    .order('name')

  return (
    <div>
      <h1 className="text-xl font-semibold text-navy-deep mb-6">Nueva casa en venta</h1>
      <SaleListingForm action={createSaleListing} properties={properties ?? []} submitLabel="Crear casa en venta" />
    </div>
  )
}
