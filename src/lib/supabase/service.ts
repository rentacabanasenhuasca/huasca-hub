// Cliente de Supabase con la service role key: se salta RLS.
//
// SOLO se usa del lado del servidor (Server Components / Server Actions),
// NUNCA se importa desde un componente cliente ni se expone la key al
// navegador. Se necesita para el buscador público: el precio final de un
// día (calendar_days) sí es público, pero para calcularlo hay que leer
// pricing_rules/rule_applications, que son privados del host (RLS los
// bloquea para un visitante anónimo). Este cliente permite recalcular
// calendar_days bajo demanda para el rango de fechas que un huésped busca,
// aunque el host nunca haya abierto esas fechas en su calendario.
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: { persistSession: false },
      // Next.js intercepta el fetch global y por default puede cachear
      // estas peticiones a Supabase entre requests. Eso hacía que, por
      // ejemplo, borrar una foto/video de portada en /admin/portada no se
      // reflejara de inmediato en la página de inicio. cache: 'no-store'
      // fuerza a que cada consulta a Supabase se lea siempre en vivo.
      global: { fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }) },
    }
  )
}
