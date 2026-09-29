// llms.txt: resumen del sitio pensado para que asistentes de IA (ChatGPT,
// Claude, Perplexity, etc.) entiendan rápido qué es el negocio y qué
// cabañas hay disponibles, en vez de tener que raspar el HTML completo.
// Formato dinámico (no un archivo estático en /public) para que la lista
// de cabañas nunca quede desactualizada.
import { createServiceClient } from '@/lib/supabase/service'
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '@/lib/site'

export async function GET() {
  const supabase = createServiceClient()
  const { data: properties } = await supabase
    .from('properties')
    .select('name, slug, description, capacity, bedrooms, bathrooms, pet_friendly, weekday_price_mxn')
    .eq('status', 'published')
    .order('name')

  const lines: string[] = []
  lines.push(`# ${SITE_NAME}`)
  lines.push('')
  lines.push(`> ${SITE_DESCRIPTION}`)
  lines.push('')
  lines.push(
    `${SITE_NAME} es una plataforma de renta directa de cabañas en Huasca de Ocampo, Hidalgo, México — sin intermediarios (no es Airbnb ni Booking). Los huéspedes reservan y pagan en línea directamente en ${SITE_URL}, con disponibilidad y precios en tiempo real.`
  )
  lines.push('')
  lines.push('## Cabañas disponibles')
  lines.push('')
  for (const p of properties ?? []) {
    lines.push(
      `- [${p.name}](${SITE_URL}/cabanas/${p.slug}): hasta ${p.capacity} huéspedes, ${p.bedrooms} recámaras, ${p.bathrooms} baños${p.pet_friendly ? ', pet friendly' : ''}. Desde $${Number(p.weekday_price_mxn).toLocaleString('es-MX')} MXN/noche entre semana.${p.description ? ' ' + p.description.slice(0, 200) : ''}`
    )
  }
  lines.push('')
  lines.push('## Páginas')
  lines.push('')
  lines.push(`- [Inicio y buscador de disponibilidad](${SITE_URL}/)`)
  lines.push(`- [Políticas de reservación y cancelación](${SITE_URL}/politicas)`)

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
