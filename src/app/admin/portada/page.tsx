import { createClient } from '@/lib/supabase/server'
import { requireHost } from '@/lib/hosts'
import HeroMediaManager from './HeroMediaManager'
import HomepagePhotosManager from './HomepagePhotosManager'
import { HOMEPAGE_SLOT_INFO, ambientFromCabins, resolveHomepagePhotos } from '@/lib/homepage-photos'
import type { HomepageSlot } from './actions'

export default async function PortadaPage() {
  const host = await requireHost()
  const supabase = await createClient()

  const [{ data: media }, { data: chosen }, { data: props }] = await Promise.all([
    supabase
      .from('hero_media')
      .select('id, media_type, url, sort_order, enabled')
      .eq('host_id', host.id)
      .order('sort_order', { ascending: true }),
    supabase.from('homepage_photos').select('slot, url').eq('host_id', host.id),
    supabase.from('properties').select('id').eq('status', 'published').order('name'),
  ])

  // Para mostrar qué foto automática sale hoy en cada lugar (misma regla que
  // la portada pública).
  const ids = (props ?? []).map((p) => p.id)
  const { data: photos } = ids.length
    ? await supabase
        .from('property_photos')
        .select('property_id, url, sort_order')
        .in('property_id', ids)
        .order('sort_order', { ascending: true })
    : { data: [] as { property_id: string; url: string }[] }
  const heroFirst = (media ?? []).find((m) => m.enabled && m.media_type === 'image')?.url ?? null
  const auto = resolveHomepagePhotos(ambientFromCabins(ids, photos ?? []), heroFirst, [])
  const chosenMap = new Map((chosen ?? []).map((c) => [c.slot, c.url]))

  const slots = HOMEPAGE_SLOT_INFO.map((s) => ({
    slot: s.slot as HomepageSlot,
    label: s.label,
    hint: s.hint,
    chosenUrl: chosenMap.get(s.slot) ?? null,
    autoUrl: auto[s.slot],
  }))

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-navy-deep">Portada</h1>
          <p className="text-sm text-stone mt-1">
            Foto principal (arriba, a pantalla completa): las fotos y/o video que subas aquí se ven en un carrusel que
            avanza solo. Si agregas un video, se reproduce en automático sin sonido.
          </p>
        </div>
        <HeroMediaManager items={media ?? []} />
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-navy-deep">Fotos de las secciones</h2>
          <p className="text-sm text-stone mt-1">
            Las demás fotos que aparecen en la página de inicio. Si no eliges una, se usa automáticamente una foto de
            tus cabañas.
          </p>
        </div>
        <HomepagePhotosManager slots={slots} />
      </section>
    </div>
  )
}
