import { createClient } from '@/lib/supabase/server'
import PropertyForm from '../PropertyForm'
import { createProperty } from '../actions'

export default async function NuevaPropiedadPage() {
  const supabase = await createClient()
  const { data: amenities } = await supabase
    .from('amenities')
    .select('id, category, label, sort_order')
    .order('category')
    .order('sort_order')

  return (
    <div>
      <h1 className="text-xl font-semibold text-navy-deep mb-6">Nueva propiedad</h1>
      <PropertyForm action={createProperty} amenities={amenities ?? []} submitLabel="Crear propiedad" />
    </div>
  )
}
