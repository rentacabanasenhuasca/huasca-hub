// Lógica compartida para sincronizar UN calendario externo (Airbnb, Booking,
// etc.) — usada tanto por las acciones manuales del panel
// (admin/propiedades/ical-actions.ts, cuando el host da clic en
// "Sincronizar") como por la sincronización automática (ver
// instrumentation.ts, que llama a syncAllIcalSourcesGlobally cada pocos
// minutos para que no se pierdan bloqueos mientras nadie está en el panel).
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { parseIcalEvents, expandEventDates } from '@/lib/ical'

export async function syncOneIcalSource(
  supabase: SupabaseClient,
  sourceId: string,
  propertyId: string,
  url: string
): Promise<{ error: string | null }> {
  let icsText: string
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return { error: `El calendario respondió con error ${res.status}.` }
    icsText = await res.text()
  } catch {
    return { error: 'No se pudo descargar ese calendario. Revisa la URL.' }
  }

  const events = parseIcalEvents(icsText)
  const dateSummaries = new Map<string, string | null>()
  for (const event of events) {
    for (const date of expandEventDates(event)) dateSummaries.set(date, event.summary)
  }

  // Reemplaza por completo lo que este calendario tenía bloqueado (así se
  // liberan fechas que se cancelaron del lado de Airbnb/Booking).
  await supabase.from('blocked_dates').delete().eq('ical_source_id', sourceId)

  if (dateSummaries.size > 0) {
    const rows = [...dateSummaries.entries()].map(([date, summary]) => ({
      property_id: propertyId,
      date,
      source: 'ical' as const,
      ical_source_id: sourceId,
      external_summary: summary,
    }))
    const CHUNK = 500
    for (let i = 0; i < rows.length; i += CHUNK) {
      // upsert por si otra fuente ya bloqueó el mismo día (unique property_id+date)
      const { error } = await supabase
        .from('blocked_dates')
        .upsert(rows.slice(i, i + CHUNK), { onConflict: 'property_id,date', ignoreDuplicates: true })
      if (error) return { error: `No se pudieron guardar los bloqueos: ${error.message}` }
    }
  }

  await supabase.from('ical_sources').update({ last_synced_at: new Date().toISOString() }).eq('id', sourceId)

  return { error: null }
}

/**
 * Sincroniza TODOS los calendarios externos de TODOS los hosts/propiedades,
 * de un jalón — usa el service client porque corre en segundo plano, sin
 * sesión de ningún host en particular (bypassa RLS a propósito, igual que
 * las páginas públicas). Pensada para llamarse cada pocos minutos desde
 * instrumentation.ts.
 */
export async function syncAllIcalSourcesGlobally(): Promise<{ synced: number; errors: string[] }> {
  const supabase = createServiceClient()

  const { data: sources, error: fetchError } = await supabase
    .from('ical_sources')
    .select('id, property_id, ical_url_import, label')

  if (fetchError) return { synced: 0, errors: [`No se pudieron leer los calendarios: ${fetchError.message}`] }
  if (!sources || sources.length === 0) return { synced: 0, errors: [] }

  const errors: string[] = []
  let synced = 0

  // En serie (no en paralelo): son pocas fuentes normalmente, y así no
  // saturamos con requests simultáneos a Airbnb/Booking si hay muchas
  // propiedades — más lento pero más confiable.
  for (const source of sources) {
    const result = await syncOneIcalSource(supabase, source.id, source.property_id, source.ical_url_import)
    if (result.error) {
      errors.push(`${source.label ?? source.id}: ${result.error}`)
    } else {
      synced++
    }
  }

  return { synced, errors }
}
