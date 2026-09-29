import type { MetadataRoute } from 'next'
import { createServiceClient } from '@/lib/supabase/service'
import { SITE_URL } from '@/lib/site'

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

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${SITE_URL}/politicas`,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    ...propertyEntries,
  ]
}
