import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/service'
import { optimizedImage } from '@/lib/media'
import { SITE_URL } from '@/lib/site'
import SiteFooter from '@/components/SiteFooter'

// Página pública de extras (leña, s'mores, decoración, picnic, masajes…),
// pensada para compartir por WhatsApp/Instagram. Se arma sola desde el
// catálogo de /admin/extras: lo que se active, desactive o cambie de precio
// ahí se ve aquí en unos minutos.
export const revalidate = 300

async function loadExtras() {
  const supabase = createServiceClient()
  const [{ data: addons }, { data: properties }, { data: host }] = await Promise.all([
    supabase
      .from('addons')
      .select('id, name, description, price_mxn, unit, photo_url')
      .eq('active', true)
      .order('sort_order', { ascending: true }),
    supabase.from('properties').select('id, name, slug').eq('status', 'published').order('name'),
    supabase.from('hosts').select('phone').not('phone', 'is', null).limit(1).maybeSingle(),
  ])
  const addonIds = (addons ?? []).map((a) => a.id)
  const { data: restrictions } = addonIds.length
    ? await supabase.from('addon_properties').select('addon_id, property_id').in('addon_id', addonIds)
    : { data: [] as { addon_id: string; property_id: string }[] }

  const published = properties ?? []
  const nameById = new Map(published.map((p) => [p.id, p.name]))
  const restrictedTo = new Map<string, string[]>()
  for (const r of restrictions ?? []) {
    if (!nameById.has(r.property_id)) continue
    restrictedTo.set(r.addon_id, [...(restrictedTo.get(r.addon_id) ?? []), nameById.get(r.property_id)!])
  }

  const extras = (addons ?? []).flatMap((a) => {
    const hasRestriction = (restrictions ?? []).some((r) => r.addon_id === a.id)
    const names = restrictedTo.get(a.id) ?? []
    // Restringido solo a cabañas que ya no están publicadas: no se ofrece.
    if (hasRestriction && names.length === 0) return []
    const everywhere = !hasRestriction || names.length >= published.length
    return [{ ...a, price_mxn: Number(a.price_mxn), availableIn: everywhere ? null : names.sort() }]
  })
  return { extras, phone: host?.phone ?? null }
}

export async function generateMetadata(): Promise<Metadata> {
  const { extras } = await loadExtras()
  const cover = extras.find((e) => e.photo_url)?.photo_url
  const title = 'Extras para tu estancia en Huasca de Ocampo: masajes, decoración y más'
  const description = `Haz tu escapada a Huasca de Ocampo más especial: ${extras
    .map((e) => e.name.toLowerCase())
    .slice(0, 5)
    .join(', ')}. Agrégalos al reservar tu cabaña.`
  return {
    title,
    description,
    alternates: { canonical: '/extras' },
    openGraph: {
      title,
      description,
      url: '/extras',
      images: cover ? [{ url: `${SITE_URL}${optimizedImage(cover, 1200)}` }] : undefined,
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function ExtrasPage() {
  const { extras, phone } = await loadExtras()
  const wa = (text: string) =>
    phone ? `https://wa.me/${phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(text)}` : null

  return (
    <div className="font-body min-h-full bg-cream">
      <div className="sticky top-4 z-30 px-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between rounded-[28px] border border-stone/10 bg-white/90 backdrop-blur-md pl-5 pr-2.5 py-2 shadow-[0_1px_3px_rgba(16,27,40,0.08)]">
          <Link href="/" className="text-xs text-stone hover:text-navy-deep transition">
            ← Ver cabañas
          </Link>
          <Link href="/" aria-label="Huasca Retreats" className="shrink-0">
            <Image src="/logo.png" alt="Huasca Retreats" width={800} height={750} className="h-16 w-auto sm:h-20 drop-shadow-md" />
          </Link>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 pt-10 pb-6">
        <h1 className="font-display text-3xl sm:text-4xl text-navy-deep">Extras para tu estancia</h1>
        <p className="text-[15px] text-stone mt-3 max-w-2xl leading-relaxed">
          Detalles para hacer tu escapada a Huasca de Ocampo más especial. Los agregas al momento de reservar tu
          cabaña, o escríbenos y te los sumamos a tu reserva.
        </p>

        {extras.length === 0 ? (
          <p className="mt-10 text-sm text-stone">Pronto tendremos extras disponibles.</p>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {extras.map((e) => {
              const link = wa(`Hola, me interesa agregar "${e.name}" a mi reserva en Huasca Retreats.`)
              return (
                <article key={e.id} className="rounded-3xl overflow-hidden border border-stone/10 bg-white shadow-sm flex flex-col">
                  {e.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={optimizedImage(e.photo_url, 640)} alt={e.name} loading="lazy" className="h-52 w-full object-cover" />
                  ) : (
                    <div className="h-52 w-full bg-gold/15" />
                  )}
                  <div className="p-5 flex flex-col flex-1">
                    <h2 className="font-display text-xl text-navy-deep">{e.name}</h2>
                    <p className="text-navy-deep font-semibold mt-1">
                      ${e.price_mxn.toLocaleString('es-MX')} MXN
                      {e.unit === 'per_unit' && <span className="text-sm font-normal text-stone"> c/u</span>}
                    </p>
                    {e.description && <p className="text-sm text-stone mt-2 leading-relaxed">{e.description}</p>}
                    <p className="text-xs text-stone mt-3">
                      {e.availableIn ? `Disponible en: ${e.availableIn.join(', ')}` : 'Disponible en todas las cabañas'}
                    </p>
                    {link && (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 pt-0 self-start rounded-full border border-stone/25 px-4 py-2 text-xs font-medium text-navy-deep hover:border-gold transition"
                      >
                        Preguntar por WhatsApp
                      </a>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <div className="mt-12 rounded-3xl bg-navy-deep px-6 py-8 text-center">
          <p className="font-display text-2xl text-cream">¿Listo para tu escapada?</p>
          <p className="text-sm text-cream/70 mt-2">Elige tu cabaña y agrega tus extras al reservar.</p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-navy-deep hover:bg-gold-light transition"
          >
            Ver cabañas disponibles
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
