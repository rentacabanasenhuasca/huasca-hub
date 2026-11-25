'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireHost } from '@/lib/hosts'
import { removeUnreferencedFiles } from '@/lib/storage-cleanup'

export async function addHeroMedia(mediaType: 'image' | 'video', url: string) {
  const host = await requireHost()
  const supabase = await createClient()

  if (!url.trim()) return { error: 'Falta la imagen o el video.' }

  const { data: existing } = await supabase
    .from('hero_media')
    .select('sort_order')
    .eq('host_id', host.id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (existing?.sort_order ?? -1) + 1

  // Devolvemos la fila insertada (con su id real, generado por la base de
  // datos) para que el panel la agregue a su lista con ese id — antes se
  // usaba un id inventado en el navegador, y si el usuario borraba ese
  // elemento sin recargar la página, el borrado no encontraba nada con ese
  // id y "tenía éxito" sin borrar realmente la fila en la base de datos.
  const { data: inserted, error } = await supabase
    .from('hero_media')
    .insert({ host_id: host.id, media_type: mediaType, url: url.trim(), sort_order: nextOrder })
    .select('id, media_type, url, sort_order, enabled')
    .single()

  if (error) return { error: `No se pudo agregar: ${error.message}`, item: null }

  revalidatePath('/admin/portada')
  revalidatePath('/')
  return { error: null, item: inserted }
}

export async function deleteHeroMedia(id: string) {
  const host = await requireHost()
  const supabase = await createClient()

  const { error } = await supabase.from('hero_media').delete().eq('id', id).eq('host_id', host.id)
  if (error) return { error: `No se pudo borrar: ${error.message}` }

  revalidatePath('/admin/portada')
  revalidatePath('/')
  return { error: null }
}

export async function toggleHeroMedia(id: string, enabled: boolean) {
  const host = await requireHost()
  const supabase = await createClient()

  const { error } = await supabase.from('hero_media').update({ enabled }).eq('id', id).eq('host_id', host.id)
  if (error) return { error: `No se pudo actualizar: ${error.message}` }

  revalidatePath('/admin/portada')
  revalidatePath('/')
  return { error: null }
}

// Intercambia el sort_order con el elemento vecino (arriba/abajo), para
// reordenar sin tener que arrastrar — más simple y confiable en móvil.
export async function moveHeroMedia(id: string, direction: 'up' | 'down') {
  const host = await requireHost()
  const supabase = await createClient()

  const { data: all } = await supabase
    .from('hero_media')
    .select('id, sort_order')
    .eq('host_id', host.id)
    .order('sort_order', { ascending: true })

  if (!all) return { error: 'No se pudo reordenar.' }

  const index = all.findIndex((m) => m.id === id)
  if (index === -1) return { error: 'Ese elemento ya no existe.' }

  const swapIndex = direction === 'up' ? index - 1 : index + 1
  if (swapIndex < 0 || swapIndex >= all.length) return { error: null }

  const current = all[index]
  const swap = all[swapIndex]

  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from('hero_media').update({ sort_order: swap.sort_order }).eq('id', current.id),
    supabase.from('hero_media').update({ sort_order: current.sort_order }).eq('id', swap.id),
  ])
  if (e1 || e2) return { error: `No se pudo reordenar: ${(e1 ?? e2)?.message}` }

  revalidatePath('/admin/portada')
  revalidatePath('/')
  return { error: null }
}

// ----------------------------------------------------------------------------
// Fotos de las secciones de la portada (historia, mosaico, cierre). Un lugar
// sin foto elegida usa automáticamente una foto de las cabañas.
// ----------------------------------------------------------------------------
const HOMEPAGE_SLOTS = ['historia', 'mosaico_1', 'mosaico_2', 'mosaico_3', 'mosaico_4', 'cierre'] as const
export type HomepageSlot = (typeof HOMEPAGE_SLOTS)[number]

async function previousSlotUrl(hostId: string, slot: HomepageSlot) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('homepage_photos')
    .select('url')
    .eq('host_id', hostId)
    .eq('slot', slot)
    .maybeSingle()
  return data?.url ?? null
}

export async function setHomepagePhoto(slot: HomepageSlot, url: string) {
  const host = await requireHost()
  if (!HOMEPAGE_SLOTS.includes(slot)) return { error: 'Lugar no válido.' }
  if (!url.trim()) return { error: 'Falta la foto.' }
  const supabase = await createClient()
  const old = await previousSlotUrl(host.id, slot)

  const { error } = await supabase
    .from('homepage_photos')
    .upsert({ host_id: host.id, slot, url: url.trim(), updated_at: new Date().toISOString() })
  if (error) return { error: `No se pudo guardar: ${error.message}` }

  if (old && old !== url.trim()) await removeUnreferencedFiles([old])
  revalidatePath('/admin/portada')
  revalidatePath('/')
  return { error: null }
}

export async function clearHomepagePhoto(slot: HomepageSlot) {
  const host = await requireHost()
  if (!HOMEPAGE_SLOTS.includes(slot)) return { error: 'Lugar no válido.' }
  const supabase = await createClient()
  const old = await previousSlotUrl(host.id, slot)

  const { error } = await supabase.from('homepage_photos').delete().eq('host_id', host.id).eq('slot', slot)
  if (error) return { error: `No se pudo quitar: ${error.message}` }

  if (old) await removeUnreferencedFiles([old])
  revalidatePath('/admin/portada')
  revalidatePath('/')
  return { error: null }
}
