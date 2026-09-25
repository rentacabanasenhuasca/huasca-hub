'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireHost } from '@/lib/hosts'
import { guessPlatform } from '@/lib/ical'
import { syncOneIcalSource } from '@/lib/ical-sync'

async function assertOwnsProperty(
  supabase: Awaited<ReturnType<typeof createClient>>,
  hostId: string,
  propertyId: string
) {
  const { data } = await supabase
    .from('properties')
    .select('id')
    .eq('id', propertyId)
    .eq('host_id', hostId)
    .maybeSingle()
  if (!data) throw new Error('Propiedad no encontrada.')
}

export async function addIcalSource(propertyId: string, formData: FormData) {
  const host = await requireHost()
  const supabase = await createClient()
  await assertOwnsProperty(supabase, host.id, propertyId)

  const label = String(formData.get('label') ?? '').trim()
  const url = String(formData.get('url') ?? '').trim()
  if (!label) return { error: 'Ponle un nombre al calendario (ej. Airbnb).' }
  if (!url) return { error: 'Falta la URL del iCal.' }

  const { data: source, error } = await supabase
    .from('ical_sources')
    .insert({ property_id: propertyId, label, platform: guessPlatform(url), ical_url_import: url })
    .select('id')
    .single()

  if (error || !source) return { error: `No se pudo agregar: ${error?.message}` }

  // Sincroniza de inmediato para que no se quede vacío hasta el próximo clic.
  await syncOneIcalSource(supabase, source.id, propertyId, url)

  revalidatePath(`/admin/propiedades/${propertyId}`)
  return { error: null }
}

export async function deleteIcalSource(propertyId: string, sourceId: string) {
  const host = await requireHost()
  const supabase = await createClient()
  await assertOwnsProperty(supabase, host.id, propertyId)

  await supabase.from('ical_sources').delete().eq('id', sourceId).eq('property_id', propertyId)

  revalidatePath(`/admin/propiedades/${propertyId}`)
}

export async function syncIcalSource(propertyId: string, sourceId: string) {
  const host = await requireHost()
  const supabase = await createClient()
  await assertOwnsProperty(supabase, host.id, propertyId)

  const { data: source } = await supabase
    .from('ical_sources')
    .select('id, ical_url_import')
    .eq('id', sourceId)
    .eq('property_id', propertyId)
    .maybeSingle()
  if (!source) return { error: 'Ese calendario ya no existe.' }

  const result = await syncOneIcalSource(supabase, source.id, propertyId, source.ical_url_import)
  revalidatePath(`/admin/propiedades/${propertyId}`)
  return result
}

export async function syncAllIcalSources(propertyId: string) {
  const host = await requireHost()
  const supabase = await createClient()
  await assertOwnsProperty(supabase, host.id, propertyId)

  const { data: sources } = await supabase
    .from('ical_sources')
    .select('id, ical_url_import')
    .eq('property_id', propertyId)

  const errors: string[] = []
  for (const s of sources ?? []) {
    const res = await syncOneIcalSource(supabase, s.id, propertyId, s.ical_url_import)
    if (res.error) errors.push(res.error)
  }

  revalidatePath(`/admin/propiedades/${propertyId}`)
  return { error: errors.length > 0 ? errors.join(' · ') : null }
}
