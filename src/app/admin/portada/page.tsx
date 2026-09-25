import { createClient } from '@/lib/supabase/server'
import { requireHost } from '@/lib/hosts'
import HeroMediaManager from './HeroMediaManager'

export default async function PortadaPage() {
  const host = await requireHost()
  const supabase = await createClient()

  const { data: media } = await supabase
    .from('hero_media')
    .select('id, media_type, url, sort_order, enabled')
    .eq('host_id', host.id)
    .order('sort_order', { ascending: true })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-navy-deep">Portada</h1>
        <p className="text-sm text-stone mt-1">
          Las fotos y/o video que se ven en la portada de la página de inicio, en un carrusel que avanza solo. Si
          agregas un video, se reproduce en automático (sin sonido) como cualquier otra diapositiva. Si no agregas
          nada aquí, la portada se ve como hasta ahora.
        </p>
      </div>

      <HeroMediaManager items={media ?? []} />
    </div>
  )
}
