// Datos de la página de una cabaña que casi no cambian (ficha, fotos,
// amenidades, camas, contacto del anfitrión). Se guardan 60 s en caché para
// que la página cargue rápido: el servidor está en Europa y la base de datos
// en Oregón, y cada consulta tarda ~0.2 s ida y vuelta. Las fechas ocupadas
// y la cotización se siguen consultando en vivo.
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { HOME_CATALOG_TAG } from '@/lib/home-catalog'

const PROPERTY_COLUMNS =
  'id, host_id, name, slug, description, capacity, bedrooms, beds, bathrooms, pet_friendly, weekday_price_mxn, weekend_price_mxn, base_occupancy, extra_guest_fee_mxn, min_nights, max_nights, cancellation_policy, show_exact_location, google_maps_link, infants_count_toward_capacity, max_infants, max_children, booking_mode, for_sale, hide_calendar, admin_rating'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function loadCabin(idOrSlug: string) {
  const supabase = createServiceClient()
  const { data: property } = await supabase
    .from('properties')
    .select(PROPERTY_COLUMNS)
    .eq(UUID_RE.test(idOrSlug) ? 'id' : 'slug', idOrSlug)
    .eq('status', 'published')
    .maybeSingle()
  if (!property) return null

  const [{ data: photos }, { data: propertyAmenities }, { data: propertyBeds }, { data: host }] = await Promise.all([
    supabase
      .from('property_photos')
      .select('url, category, description, sort_order')
      .eq('property_id', property.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('property_amenities')
      .select('description, amenities(label, category)')
      .eq('property_id', property.id),
    supabase
      .from('property_beds')
      .select('room_type, room_number, bed_type, quantity')
      .eq('property_id', property.id)
      .order('sort_order', { ascending: true }),
    supabase.from('hosts').select('name, phone, email').eq('id', property.host_id).maybeSingle(),
  ])

  return {
    property,
    photos: photos ?? [],
    propertyAmenities: propertyAmenities ?? [],
    propertyBeds: propertyBeds ?? [],
    host: host ?? null,
  }
}

export const getCabinData = unstable_cache(loadCabin, ['cabin-data-v1'], {
  revalidate: 60,
  tags: [HOME_CATALOG_TAG],
})
