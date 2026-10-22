// Casas en venta (/en-venta): tipos y utilidades compartidas entre el panel
// (/admin/ventas) y las páginas públicas.
import type { SupabaseClient } from '@supabase/supabase-js'
import { slugifyBase } from '@/lib/slug'

export type SaleStatus = 'draft' | 'published' | 'sold'

export type SaleListing = {
  id: string
  host_id: string
  property_id: string | null
  slug: string
  title: string
  status: SaleStatus
  price_mxn: number | null
  price_note: string | null
  location: string | null
  summary: string | null
  description: string | null
  bedrooms: number | null
  bathrooms: number | null
  land_m2: number | null
  built_m2: number | null
  parking: number | null
  features: string[]
  google_maps_link: string | null
  video_url: string | null
  contact_whatsapp: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type SaleMedia = {
  id?: string
  kind: 'image' | 'video'
  url: string
  caption: string | null
  sort_order?: number
}

export const SALE_STATUS_LABEL: Record<SaleStatus, string> = {
  draft: 'Borrador (no visible)',
  published: 'Publicada (en venta)',
  sold: 'Vendida (se muestra como vendida)',
}

/** Slug único dentro de sale_listings (agrega -2, -3… si ya existe). */
export async function uniqueSaleSlug(supabase: SupabaseClient, title: string, excludeId?: string) {
  const base = slugifyBase(title) || 'casa-en-venta'
  let candidate = base
  let n = 2
  while (true) {
    let q = supabase.from('sale_listings').select('id').eq('slug', candidate)
    if (excludeId) q = q.neq('id', excludeId)
    const { data } = await q.maybeSingle()
    if (!data) return candidate
    candidate = `${base}-${n}`
    n += 1
  }
}

export function formatPrice(price: number | null | undefined) {
  if (price == null) return null
  return `$${Math.round(Number(price)).toLocaleString('es-MX')} MXN`
}

/** Convierte un link de YouTube o Vimeo en su URL para insertar (iframe). */
export function videoEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url.trim())
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') return `https://www.youtube.com/embed/${u.pathname.slice(1)}`
    if (host.endsWith('youtube.com')) {
      if (u.pathname.startsWith('/embed/')) return u.toString()
      if (u.pathname.startsWith('/shorts/')) return `https://www.youtube.com/embed/${u.pathname.split('/')[2]}`
      const v = u.searchParams.get('v')
      if (v) return `https://www.youtube.com/embed/${v}`
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0]
      if (id) return `https://player.vimeo.com/video/${id}`
    }
  } catch {
    return null
  }
  return null
}

export function whatsappDigits(phone: string | null | undefined) {
  const d = (phone ?? '').replace(/\D/g, '')
  if (!d) return null
  return d.length === 10 ? `52${d}` : d
}
