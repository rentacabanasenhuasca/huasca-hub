import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { requireHost } from '@/lib/hosts'
import PropertyForm, { type BedRecord } from '../PropertyForm'
import { updateProperty, deleteProperty, duplicateProperty } from '../actions'
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

  const [{ data: amenities }, { data: propertyAmenities }, { data: photos }, { data: beds }, { data: icalSources }, { data: emailTemplates }] =
    await Promise.all([
      supabase.from('amenities').select('id, category, label, sort_order').order('category').order('sort_order'),
      supabase.from('property_amenities').select('amenity_id, description').eq('property_id', id),
      supabase
        .from('property_photos')
        .select('url, category, description')
        .eq('property_id', id)
        .order('sort_order'),
      supabase
        .from('property_beds')
        .select('room_type, bed_type, quantity')
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
  // No usamos .bind aquí como con boundDelete: duplicateProperty puede
  // devolver { error } cuando falla, y el action de un <form> debe regresar
  // void | Promise<void> — este wrapper descarta ese valor para cumplir el
  // tipo (el error, si ocurre, simplemente no se refleja en la UI por ahora).
  async function boundDuplicate() {
    'use server'
    await duplicateProperty(id)
  }

  const hdrs = await headers()
  const requestHost = hdrs.get('host') ?? 'localhost:3000'
  const protocol = hdrs.get('x-forwarded-proto') ?? (requestHost.startsWith('localhost') ? 'http' : 'https')
  const exportUrl = `${protocol}://${requestHost}/api/ical/${id}`

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-navy-deep">{property.name}</h1>
        <div className="flex items-center gap-4">
          <form action={boundDuplicate}>
            <button type="submit" className="text-sm text-gold hover:underline">
              Duplicar propiedad
            </button>
          </form>
          <form action={boundDelete}>
          <ConfirmSubmitButton
            confirmMessage={`¿Seguro que quieres eliminar "${property.name}"? Esto borra también sus fotos, amenidades y reglas de precio aplicadas. No se puede deshacer.`}
            className="text-sm text-burnt-orange hover:underline"
          >
            Eliminar propiedad
          </ConfirmSubmitButton>
        </form>
        </div>
      </div>
      <PropertyForm
        action={boundUpdate}
        amenities={amenities ?? []}
        property={property}
        selectedAmenities={selectedAmenities}
        photos={photos ?? []}
        beds={(beds ?? []) as BedRecord[]}
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
