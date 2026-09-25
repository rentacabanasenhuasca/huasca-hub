import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { requireHost } from '@/lib/hosts'
import PropertyForm from '../PropertyForm'
import { updateProperty, deleteProperty } from '../actions'
import ConfirmSubmitButton from '@/components/ConfirmSubmitButton'
import IcalSources from './IcalSources'
import EmailTemplates from './EmailTemplates'

export default async function EditarPropiedadPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const host = await requireHost()
  const supabase = await createClient()

  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .eq('host_id', host.id)
    .maybeSingle()

  if (!property) notFound()

  const [{ data: amenities }, { data: propertyAmenities }, { data: photos }, { data: icalSources }, { data: emailTemplates }] =
    await Promise.all([
      supabase.from('amenities').select('id, category, label, sort_order').order('category').order('sort_order'),
      supabase.from('property_amenities').select('amenity_id, description').eq('property_id', id),
      supabase
        .from('property_photos')
        .select('url, category, description')
        .eq('property_id', id)
        .order('sort_order'),
      supabase
        .from('ical_sources')
        .select('id, label, platform, ical_url_import, last_synced_at')
        .eq('property_id', id)
        .order('label'),
      supabase
        .from('email_templates')
        .select('id, name, recipient_type, recipient_emails, subject, body, enabled')
        .eq('property_id', id)
        .order('created_at'),
    ])

  const selectedAmenities = Object.fromEntries(
    (propertyAmenities ?? []).map((pa) => [pa.amenity_id, pa.description])
  )

  const boundUpdate = updateProperty.bind(null, id)
  const boundDelete = deleteProperty.bind(null, id)

  const hdrs = await headers()
  const requestHost = hdrs.get('host') ?? 'localhost:3000'
  const protocol = hdrs.get('x-forwarded-proto') ?? (requestHost.startsWith('localhost') ? 'http' : 'https')
  const exportUrl = `${protocol}://${requestHost}/api/ical/${id}`

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-navy-deep">{property.name}</h1>
        <form action={boundDelete}>
          <ConfirmSubmitButton
            confirmMessage={`¿Seguro que quieres eliminar "${property.name}"? Esto borra también sus fotos, amenidades y reglas de precio aplicadas. No se puede deshacer.`}
            className="text-sm text-burnt-orange hover:underline"
          >
            Eliminar propiedad
          </ConfirmSubmitButton>
        </form>
      </div>
      <PropertyForm
        action={boundUpdate}
        amenities={amenities ?? []}
        property={property}
        selectedAmenities={selectedAmenities}
        photos={photos ?? []}
        submitLabel="Guardar cambios"
      />

      <div className="mt-6">
        <IcalSources propertyId={id} sources={icalSources ?? []} exportUrl={exportUrl} />
      </div>

      <div className="mt-6">
        <EmailTemplates propertyId={id} templates={emailTemplates ?? []} />
      </div>
    </div>
  )
}
