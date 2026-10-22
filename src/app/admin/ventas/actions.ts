'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireHost } from '@/lib/hosts'
import { uniqueSaleSlug, type SaleMedia, type SaleStatus } from '@/lib/sale-listings'

type ActionState = { error: string | null }

function text(formData: FormData, field: string): string | null {
  const v = String(formData.get(field) ?? '').trim()
  return v || null
}

function num(formData: FormData, field: string): number | null {
  const raw = String(formData.get(field) ?? '').replace(/[,\s$]/g, '')
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function parseMedia(formData: FormData): SaleMedia[] {
  try {
    const list = JSON.parse(String(formData.get('media_json') || '[]')) as SaleMedia[]
    return list
      .filter((m) => m && typeof m.url === 'string' && m.url.startsWith('http'))
      .map((m) => ({ kind: m.kind === 'video' ? 'video' : 'image', url: m.url, caption: m.caption?.trim() || null }))
  } catch {
    return []
  }
}

function buildPayload(formData: FormData) {
  const status = String(formData.get('status') || 'draft') as SaleStatus
  return {
    title: String(formData.get('title') || '').trim(),
    status: (['draft', 'published', 'sold'].includes(status) ? status : 'draft') as SaleStatus,
    property_id: text(formData, 'property_id'),
    price_mxn: num(formData, 'price_mxn'),
    price_note: text(formData, 'price_note'),
    location: text(formData, 'location'),
    summary: text(formData, 'summary'),
    description: text(formData, 'description'),
    bedrooms: num(formData, 'bedrooms'),
    bathrooms: num(formData, 'bathrooms'),
    land_m2: num(formData, 'land_m2'),
    built_m2: num(formData, 'built_m2'),
    parking: num(formData, 'parking'),
    features: String(formData.get('features') || '')
      .split('\n')
      .map((l) => l.replace(/^[-•*\s]+/, '').trim())
      .filter(Boolean),
    google_maps_link: text(formData, 'google_maps_link'),
    video_url: text(formData, 'video_url'),
    contact_whatsapp: text(formData, 'contact_whatsapp'),
    updated_at: new Date().toISOString(),
  }
}

async function saveMedia(supabase: Awaited<ReturnType<typeof createClient>>, listingId: string, media: SaleMedia[]) {
  await supabase.from('sale_listing_media').delete().eq('listing_id', listingId)
  if (media.length === 0) return null
  const { error } = await supabase
    .from('sale_listing_media')
    .insert(media.map((m, i) => ({ listing_id: listingId, kind: m.kind, url: m.url, caption: m.caption, sort_order: i })))
  return error ? `No se pudieron guardar las fotos/videos: ${error.message}` : null
}

export async function createSaleListing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const host = await requireHost()
  const supabase = await createClient()
  const payload = buildPayload(formData)
  if (!payload.title) return { error: 'Ponle un título a la casa.' }

  const slug = await uniqueSaleSlug(supabase, payload.title)
  const { data, error } = await supabase
    .from('sale_listings')
    .insert({ ...payload, host_id: host.id, slug })
    .select('id')
    .single()
  if (error || !data) return { error: `No se pudo crear: ${error?.message}` }

  const mediaError = await saveMedia(supabase, data.id, parseMedia(formData))
  if (mediaError) return { error: mediaError }

  revalidatePath('/admin/ventas')
  revalidatePath('/en-venta')
  redirect(`/admin/ventas/${data.id}?guardado=1`)
}

export async function updateSaleListing(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const host = await requireHost()
  const supabase = await createClient()
  const payload = buildPayload(formData)
  if (!payload.title) return { error: 'Ponle un título a la casa.' }

  const { data: current } = await supabase
    .from('sale_listings')
    .select('slug, title')
    .eq('id', id)
    .eq('host_id', host.id)
    .maybeSingle()
  if (!current) return { error: 'Esa casa no existe.' }

  // El link se mantiene aunque cambie el título (para no romper links ya
  // compartidos), salvo que el host pida explícitamente regenerarlo.
  const slug =
    formData.get('regenerate_slug') === 'on' ? await uniqueSaleSlug(supabase, payload.title, id) : current.slug

  const { error } = await supabase.from('sale_listings').update({ ...payload, slug }).eq('id', id).eq('host_id', host.id)
  if (error) return { error: `No se pudo guardar: ${error.message}` }

  const mediaError = await saveMedia(supabase, id, parseMedia(formData))
  if (mediaError) return { error: mediaError }

  revalidatePath('/admin/ventas')
  revalidatePath('/en-venta')
  revalidatePath(`/en-venta/${slug}`)
  redirect(`/admin/ventas/${id}?guardado=1`)
}

export async function deleteSaleListing(id: string) {
  const host = await requireHost()
  const supabase = await createClient()
  await supabase.from('sale_listings').delete().eq('id', id).eq('host_id', host.id)
  revalidatePath('/admin/ventas')
  revalidatePath('/en-venta')
  redirect('/admin/ventas')
}
