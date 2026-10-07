// Fotos y videos del sitio servidos desde NUESTRO servidor (Hetzner) en vez
// de directo desde Supabase Storage.
//
// Por qué: Supabase (plan gratis) solo incluye 5 GB al mes de salida de
// archivos y el sitio llegó a ~26 GB en dos semanas, porque cada visita
// descargaba las fotos en tamaño original (algunas de 5+ MB, incluso para
// miniaturas de 28px) y el video de la portada (8 MB) directo de Supabase.
//
// - Fotos: pasan por el optimizador de imágenes de Next (/_next/image), que
//   las descarga de Supabase UNA vez, las redimensiona/comprime y las guarda
//   en disco del servidor (ver images.minimumCacheTTL en next.config.ts).
// - Video (y cualquier otro archivo): pasa por /media/..., que lo descarga
//   de Supabase una vez y lo sirve desde memoria (ver app/media/[...path]).

const PUBLIC_MARKER = '/storage/v1/object/public/'

// Anchos permitidos por el optimizador de Next 16 (deviceSizes + imageSizes
// por defecto). Usar otro ancho da error 400.
export type ImageWidth = 64 | 128 | 256 | 384 | 640 | 828 | 1080 | 1200 | 1920

function isSupabasePublic(url: string) {
  return url.includes(PUBLIC_MARKER)
}

/** URL de una foto de Supabase ya redimensionada y cacheada en el servidor. */
export function optimizedImage(url: string | null | undefined, width: ImageWidth): string {
  if (!url) return ''
  if (!isSupabasePublic(url)) return url
  return `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=75`
}

/** URL de un archivo de Supabase (p. ej. video) servido y cacheado por nuestro servidor. */
export function cachedMedia(url: string | null | undefined): string {
  if (!url) return ''
  const i = url.indexOf(PUBLIC_MARKER)
  if (i < 0) return url
  return `/media/${url.slice(i + PUBLIC_MARKER.length)}`
}
