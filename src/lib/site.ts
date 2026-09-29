// Dominio "real" del sitio para SEO (canonical URLs, sitemap, robots,
// JSON-LD, Open Graph). El sitio hoy corre en la URL temporal de Coolify
// mientras se conecta el dominio propio — dejamos aquí ya apuntando a
// huascaretreats.com para que todo el trabajo de SEO quede listo desde
// el día uno en que se conecte el dominio (o se puede sobreescribir con
// NEXT_PUBLIC_SITE_URL en Coolify si cambia).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://huascaretreats.com').replace(/\/$/, '')
export const SITE_NAME = 'Huasca Retreats'
export const SITE_DESCRIPTION =
  'Cabañas y espacios de descanso exclusivos en Huasca de Ocampo, Hidalgo — renta directa, sin intermediarios. Reserva en línea con disponibilidad y precios en tiempo real.'

// Palabras clave núcleo del negocio, resultado de cruzar cómo la gente
// busca hospedaje en Huasca de Ocampo (renta de cabañas, jacuzzi, pet
// friendly, grupos, cerca de Prismas Basálticos) con lo que el catálogo de
// cabañas realmente ofrece. Se usan como base para title/description de
// cada página y para las descripciones que ve la IA al indexar el sitio.
export const CORE_KEYWORDS = [
  'cabañas en Huasca de Ocampo',
  'renta de cabañas Huasca de Ocampo',
  'hospedaje Huasca de Ocampo',
  'cabañas con jacuzzi Huasca',
  'cabañas para grupos Huasca de Ocampo',
  'cabañas pet friendly Huasca',
  'dónde hospedarse en Huasca de Ocampo',
  'cabañas cerca de Prismas Basálticos',
  'Huasca de Ocampo pueblo mágico hospedaje',
  'renta directa de cabañas sin intermediarios',
]
