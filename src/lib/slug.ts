// Slugs amigables para URLs públicas (/cabanas/<slug>) en vez de UUIDs
// crudos — buenos para SEO y para compartir en redes/WhatsApp.
import type { SupabaseClient } from '@supabase/supabase-js'

export function slugifyBase(input: string): string {
  const cleaned = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return cleaned || 'cabana'
}

// Genera un slug único para una propiedad nueva (o al renombrar una
// existente), agregando -2, -3... si ya existe otra propiedad con ese
// mismo slug. `excludePropertyId` evita que una propiedad choque consigo
// misma al reutilizar su propio slug.
export async function generateUniqueSlug(
  supabase: SupabaseClient,
  name: string,
  excludePropertyId?: string
): Promise<string> {
  const base = slugifyBase(name)
  let candidate = base
  let n = 2
  // Con pocas propiedades esto nunca itera más de una o dos veces.
  while (true) {
    let query = supabase.from('properties').select('id').eq('slug', candidate)
    if (excludePropertyId) query = query.neq('id', excludePropertyId)
    const { data } = await query.maybeSingle()
    if (!data) return candidate
    candidate = `${base}-${n}`
    n += 1
  }
}
