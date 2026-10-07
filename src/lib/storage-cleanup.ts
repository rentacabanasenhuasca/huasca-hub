// Borra de Supabase Storage los archivos que ya nadie usa.
//
// Antes, al quitar una foto en el panel (o borrar una propiedad) solo se
// borraba el renglón en la base de datos y el archivo se quedaba alojado
// para siempre en Storage. Ojo: "Duplicar propiedad" copia las MISMAS URLs
// de fotos a la propiedad nueva, así que antes de borrar un archivo
// revisamos que ninguna otra propiedad, portada o extra lo siga usando.
import { createServiceClient } from '@/lib/supabase/service'

const PUBLIC_MARKER = '/storage/v1/object/public/'

function toBucketPath(url: string): { bucket: string; path: string } | null {
  const i = url.indexOf(PUBLIC_MARKER)
  if (i < 0) return null
  const rest = url.slice(i + PUBLIC_MARKER.length)
  const slash = rest.indexOf('/')
  if (slash < 0) return null
  return { bucket: rest.slice(0, slash), path: decodeURIComponent(rest.slice(slash + 1)) }
}

export async function removeUnreferencedFiles(urls: string[]) {
  const unique = [...new Set(urls.filter(Boolean))]
  if (unique.length === 0) return
  const supabase = createServiceClient()

  const [{ data: photos }, { data: hero }, { data: addons }] = await Promise.all([
    supabase.from('property_photos').select('url').in('url', unique),
    supabase.from('hero_media').select('url').in('url', unique),
    supabase.from('addons').select('photo_url').in('photo_url', unique),
  ])
  const stillUsed = new Set<string>([
    ...(photos ?? []).map((r) => r.url),
    ...(hero ?? []).map((r) => r.url),
    ...(addons ?? []).map((r) => r.photo_url as string),
  ])

  const byBucket = new Map<string, string[]>()
  for (const url of unique) {
    if (stillUsed.has(url)) continue
    const loc = toBucketPath(url)
    if (!loc) continue
    byBucket.set(loc.bucket, [...(byBucket.get(loc.bucket) ?? []), loc.path])
  }

  // Mejor esfuerzo: si falla, solo queda un archivo huérfano (no rompe nada).
  for (const [bucket, paths] of byBucket) {
    await supabase.storage.from(bucket).remove(paths).catch(() => {})
  }
}
