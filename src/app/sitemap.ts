import type { MetadataRoute } from 'next'
import { createServiceClient } from '@/lib/supabase/service'
import { SITE_URL } from '@/lib/site'
import { LANDINGS } from '@/lib/seo-landings'

// Sitemap dinámico: se regenera solo cuando cambian las cabañas publicadas,
// sin tener que tocar código cada vez que se agrega/quita una propiedad.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createServiceClient()
  const { data: properties } = await supabase
    .from('properties')
    .select('slug')
    .eq('status', 'published')

  const propertyEntries: MetadataRoute.Sitemap = (properties ?? []).map((p) => ({
    url: `${SITE_URL}/cabanas/${p.slug}`,
    changeFrequency: 'daily',
    priority: 0.8,
  }))

  const { data: saleListings } = await supabase
    .from('sale_listings')
    .select('slug')
    .eq('status', 'published')
  const saleEntries: MetadataRoute.Sitemap = (saleListings ?? []).map((l) => ({
    url: `${SITE_URL}/en-venta/${l.slug}`,
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${SITE_URL}/extras`,
      changeFrequency: 'weekly',
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/politicas`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/reglamento`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    // Páginas por intención de búsqueda (jacuzzi, glamping, grupos...).
    ...LANDINGS.map((l) => ({
      url: `${SITE_URL}/${l.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    })),
    {
      url: `${SITE_URL}/en-venta`,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    ...propertyEntries,
    ...saleEntries,
  ]
}
