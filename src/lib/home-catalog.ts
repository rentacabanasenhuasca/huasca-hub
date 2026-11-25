// Datos de la portada que casi no cambian (cabañas publicadas, sus fotos,
// portada, fotos de secciones, casas en venta, WhatsApp del anfitrión).
//
// Por qué en caché: el servidor (Hetzner, Europa) y la base de datos
// (Supabase, Oregón) están lejos; cada consulta tarda ~0.2 s ida y vuelta y
// la portada hacía ~10 seguidas (≈2.5 s antes de empezar a mandar la
// página). Ahora estas consultas van en paralelo y el resultado se guarda
// 60 s, así que casi todas las visitas se sirven sin esperar a la base.
//
// Lo que SÍ debe estar al momento (fechas ocupadas y precios de una
// búsqueda) se sigue consultando en vivo en cada visita.
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

export const HOME_CATALOG_TAG = 'home-catalog'

const PROPERTY_COLUMNS =
  'id, host_id, name, slug, capacity, bedrooms, bathrooms, weekday_price_mxn, weekend_price_mxn, base_occupancy, extra_guest_fee_mxn, min_nights, pet_friendly, max_children, max_infants, infants_count_toward_capacity, booking_mode, for_sale, hide_calendar, admin_rating, price_tier'

async function loadHomeCatalog() {
  const supabase = createServiceClient()

  const [{ data: properties }, { data: saleListings }] = await Promise.all([
    supabase.from('properties').select(PROPERTY_COLUMNS).eq('status', 'published').order('name'),
    supabase
      .from('sale_listings')
      .select('id')
      .eq('status', 'published')
      .order('sort_order')
      .order('created_at', { ascending: false }),
  ])

  const propertyIds = (properties ?? []).map((p) => p.id as string)
  const hostId = (properties?.[0]?.host_id as string | undefined) ?? null
  const firstSaleId = saleListings?.[0]?.id ?? null

  const [photosRes, hostRes, heroRes, chosenRes, saleCoverRes, jacuzziRes] = await Promise.all([
    propertyIds.length
      ? supabase
          .from('property_photos')
          .select('property_id, url, sort_order')
          .in('property_id', propertyIds)
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: [] as { property_id: string; url: string; sort_order: number }[] }),
    hostId
      ? supabase.from('hosts').select('phone').eq('id', hostId).maybeSingle()
      : Promise.resolve({ data: null as { phone: string | null } | null }),
    hostId
      ? supabase
          .from('hero_media')
          .select('id, media_type, url')
          .eq('enabled', true)
          .eq('host_id', hostId)
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: [] as { id: string; media_type: 'image' | 'video'; url: string }[] }),
    hostId
      ? supabase.from('homepage_photos').select('slot, url').eq('host_id', hostId)
      : Promise.resolve({ data: [] as { slot: string; url: string }[] }),
    firstSaleId
      ? supabase
          .from('sale_listing_media')
          .select('url')
          .eq('listing_id', firstSaleId)
          .eq('kind', 'image')
          .order('sort_order')
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null as { url: string } | null }),
    // Cabañas con la amenidad "Jacuzzi" (para el filtro del buscador).
    propertyIds.length
      ? supabase
          .from('property_amenities')
          .select('property_id, amenities!inner(label)')
          .in('property_id', propertyIds)
          .ilike('amenities.label', 'jacuzzi')
      : Promise.resolve({ data: [] as { property_id: string }[] }),
  ])

  return {
    properties: properties ?? [],
    hostId,
    hostPhone: (hostRes.data?.phone as string | null | undefined) ?? null,
    saleCount: saleListings?.length ?? 0,
    saleCoverUrl: (saleCoverRes.data?.url as string | undefined) ?? null,
    photos: (photosRes.data ?? []) as { property_id: string; url: string; sort_order: number }[],
    heroMedia: (heroRes.data ?? []) as { id: string; media_type: 'image' | 'video'; url: string }[],
    chosenPhotos: (chosenRes.data ?? []) as { slot: string; url: string }[],
    jacuzziPropertyIds: ((jacuzziRes.data ?? []) as { property_id: string }[]).map((r) => r.property_id),
  }
}

export const getHomeCatalog = unstable_cache(loadHomeCatalog, ['home-catalog-v1'], {
  revalidate: 60,
  tags: [HOME_CATALOG_TAG],
})

// Teléfono de WhatsApp del botón flotante (layout de todas las páginas).
export const getSitePhone = unstable_cache(
  async () => {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('hosts')
      .select('phone')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    return (data?.phone as string | null | undefined) ?? null
  },
  ['site-phone-v1'],
  { revalidate: 300, tags: [HOME_CATALOG_TAG] }
)
