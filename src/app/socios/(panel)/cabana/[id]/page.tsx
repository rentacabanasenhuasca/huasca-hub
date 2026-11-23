import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePartner, partnerProperty } from '@/lib/partners'
import { createServiceClient } from '@/lib/supabase/service'
import { SITE_URL } from '@/lib/site'
import { partnerAddIcal, partnerDeleteIcal, savePartnerProperty } from '../../../actions'
import PartnerPropertyForm from '../PartnerPropertyForm'
import StateButtons from '../StateButtons'
import IcalPanel from '../IcalPanel'
import { loadAmenities, splitDescription } from '../load'

export const dynamic = 'force-dynamic'

export default async function EditarCabanaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ enviada?: string }>
}) {
  const partner = await requirePartner()
  const { id } = await params
  const { enviada } = await searchParams
  const property = await partnerProperty(partner.id, id)
  if (!property) notFound()

  const service = createServiceClient()
  const [amenities, { data: chosen }, { data: photos }, { data: sources }, { data: beds }] = await Promise.all([
    loadAmenities(),
    service.from('property_amenities').select('amenity_id').eq('property_id', id),
    service.from('property_photos').select('url, sort_order').eq('property_id', id).order('sort_order'),
    service.from('ical_sources').select('id, label, platform, last_synced_at, last_sync_status').eq('property_id', id).order('label'),
    service.from('property_beds').select('room_type, room_number, bed_type, quantity').eq('property_id', id).order('sort_order'),
  ])
  const parts = splitDescription(property.description as string | null)

  return (
    <div className="space-y-5">
      <Link href="/socios" className="text-xs text-stone hover:text-navy-deep">← Mis cabañas</Link>
      {enviada && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800">
          ¡Listo! Recibimos tu cabaña. La revisamos y te avisamos por correo cuando quede publicada. Mientras, conecta tu calendario abajo y
          registra tus datos de pago.
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-navy-deep">{property.name}</h1>
        <div className="flex flex-wrap gap-2">
          <Link href={`/socios/cabana/${id}/calendario`} className="rounded-lg border border-stone/25 bg-white px-3 py-1.5 text-xs text-navy-deep hover:border-gold">
            Bloquear / abrir fechas
          </Link>
          <StateButtons propertyId={id} state={property.partner_state as string} />
        </div>
      </div>

      <IcalPanel
        propertyId={id}
        exportUrl={`${SITE_URL}/api/ical/${id}`}
        sources={(sources ?? []).map((s) => ({
          id: s.id as string,
          label: s.label as string,
          platform: s.platform as string,
          last_synced_at: s.last_synced_at as string | null,
          last_sync_status: s.last_sync_status as string | null,
        }))}
        addAction={partnerAddIcal.bind(null, id)}
        deleteAction={partnerDeleteIcal}
      />

      <PartnerPropertyForm
        action={savePartnerProperty.bind(null, id)}
        userId={partner.user_id}
        amenities={amenities}
        markupPct={Number(property.partner_markup_pct)}
        feePct={Number(property.partner_fee_pct)}
        submitLabel="Guardar cambios"
        initial={{
          name: property.name as string,
          description: parts.description,
          location_text: parts.location,
          services_text: parts.services,
          google_maps_link: (property.google_maps_link as string | null) ?? '',
          capacity: Number(property.capacity ?? 2),
          bedrooms: Number(property.bedrooms ?? 1),
          beds: Number(property.beds ?? 1),
          bathrooms: Number(property.bathrooms ?? 1),
          pet_friendly: Boolean(property.pet_friendly),
          min_nights: Number(property.min_nights ?? 1),
          partner_price_weekday: property.partner_price_weekday ? Number(property.partner_price_weekday) : '',
          partner_price_weekend: property.partner_price_weekend ? Number(property.partner_price_weekend) : '',
          amenity_ids: (chosen ?? []).map((a) => a.amenity_id as string),
          photos: (photos ?? []).map((p) => p.url as string),
          bed_rows: (beds ?? []).map((b) => ({
            room_type: b.room_type as 'recamara' | 'altillo_tapanco' | 'otro',
            room_number: b.room_number as number | null,
            bed_type: b.bed_type as string,
            quantity: Number(b.quantity) || 1,
          })),
        }}
      />
    </div>
  )
}
