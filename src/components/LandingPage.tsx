import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase/service'
import { SITE_URL, SITE_NAME } from '@/lib/site'
import { optimizedImage } from '@/lib/media'
import { GENERAL_FAQS, LANDINGS, getLanding, type LandingProperty } from '@/lib/seo-landings'
import SiteFooter from '@/components/SiteFooter'
import ForSaleBadge from '@/components/ForSaleBadge'

// Página de aterrizaje SEO (ver src/lib/seo-landings.ts). Server component:
// las cabañas se leen en cada visita, así que una propiedad nueva aparece
// sola en las páginas cuyo filtro cumple.

type CardProperty = LandingProperty & {
  id: string
  slug: string
  bedrooms: number
  weekday_price_mxn: number
  booking_mode: string | null
  for_sale: boolean | null
  cover: string | null
}

async function loadProperties(): Promise<CardProperty[]> {
  const supabase = createServiceClient()
  const { data: properties } = await supabase
    .from('properties')
    .select('id, slug, name, description, capacity, bedrooms, pet_friendly, weekday_price_mxn, booking_mode, for_sale')
    .eq('status', 'published')
    .order('name')
  const ids = (properties ?? []).map((p) => p.id)
  if (ids.length === 0) return []

  const [{ data: amenityRows }, { data: photos }] = await Promise.all([
    supabase.from('property_amenities').select('property_id, amenities(label)').in('property_id', ids),
    supabase.from('property_photos').select('property_id, url, sort_order').in('property_id', ids).order('sort_order'),
  ])

  const amenitiesBy = new Map<string, string[]>()
  for (const row of (amenityRows ?? []) as unknown as { property_id: string; amenities: { label: string } | { label: string }[] | null }[]) {
    const a = Array.isArray(row.amenities) ? row.amenities[0] : row.amenities
    if (!a) continue
    const list = amenitiesBy.get(row.property_id) ?? []
    list.push(a.label)
    amenitiesBy.set(row.property_id, list)
  }
  const coverBy = new Map<string, string>()
  for (const ph of photos ?? []) if (!coverBy.has(ph.property_id)) coverBy.set(ph.property_id, ph.url)

  return (properties ?? []).map((p) => ({
    ...p,
    weekday_price_mxn: Number(p.weekday_price_mxn),
    amenities: amenitiesBy.get(p.id) ?? [],
    cover: coverBy.get(p.id) ?? null,
  }))
}

export async function landingMetadata(slug: string): Promise<Metadata> {
  const landing = getLanding(slug)
  if (!landing) return {}
  const properties = await loadProperties()
  const image = properties.filter(landing.filter)[0]?.cover ?? properties[0]?.cover ?? undefined
  return {
    title: landing.title,
    description: landing.description,
    alternates: { canonical: `/${landing.slug}` },
    openGraph: {
      type: 'website',
      title: `${landing.title} | ${SITE_NAME}`,
      description: landing.description,
      url: `/${landing.slug}`,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: { card: 'summary_large_image', title: landing.title, description: landing.description, images: image ? [image] : undefined },
  }
}

function highlights(p: CardProperty): string[] {
  const out: string[] = []
  const has = (l: string) => p.amenities.some((a) => a.toLowerCase() === l.toLowerCase())
  if (has('Jacuzzi')) out.push('Jacuzzi')
  if (has('Chimenea interior')) out.push('Chimenea')
  if (/cristal/i.test(p.description ?? '') || /glasshouse/i.test(p.name)) out.push('Techo de cristal')
  if (has('Fogata / fogatero')) out.push('Fogata')
  if (p.pet_friendly) out.push('Pet friendly')
  return out.slice(0, 4)
}

export default async function LandingPage({ slug }: { slug: string }) {
  const landing = getLanding(slug)!
  const all = await loadProperties()
  const matches = all.filter(landing.filter)
  const properties = matches.length > 0 ? matches : all
  const faqs = [...landing.faqs, ...GENERAL_FAQS]
  const related = LANDINGS.filter((l) => l.slug !== landing.slug)

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: landing.h1, item: `${SITE_URL}/${landing.slug}` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: landing.listHeading,
      itemListElement: properties.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_URL}/cabanas/${p.slug}`,
        name: p.name,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ]

  return (
    <div className="font-body min-h-full bg-cream">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="sticky top-4 z-30 px-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 rounded-[28px] border border-stone/10 bg-white/90 backdrop-blur-md px-5 py-2 shadow-[0_1px_3px_rgba(16,27,40,0.08)]">
          <Link href="/" className="text-xs text-stone hover:text-navy-deep transition">
            ← Todas las cabañas
          </Link>
          <Link href="/" aria-label={SITE_NAME}>
            <Image src="/logo.png" alt={`${SITE_NAME} — cabañas en Huasca de Ocampo`} width={800} height={750} className="h-16 w-auto sm:h-20" />
          </Link>
        </div>
      </div>

      <header className="max-w-3xl mx-auto px-4 pt-14 sm:pt-20 pb-8 text-center">
        <nav aria-label="Migas de pan" className="text-xs text-stone mb-4">
          <Link href="/" className="hover:text-navy-deep">Inicio</Link> <span aria-hidden>›</span> {landing.label}
        </nav>
        <p className="text-xs tracking-[0.3em] uppercase text-gold mb-3">{landing.eyebrow}</p>
        <h1 className="font-display font-black text-3xl sm:text-5xl text-navy-deep leading-tight">{landing.h1}</h1>
        <div className="mt-6 space-y-4 text-left sm:text-center text-stone leading-relaxed">
          {landing.intro.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pb-8">
        <h2 className="font-display text-2xl sm:text-3xl text-navy-deep mb-5">{landing.listHeading}</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => {
            const tags = highlights(p)
            return (
              <Link
                key={p.id}
                href={`/cabanas/${p.slug}`}
                className="group relative block rounded-3xl border border-stone/10 bg-white overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-navy-deep/10"
              >
                {p.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={optimizedImage(p.cover, 640)}
                    loading="lazy"
                    alt={`${p.name}, cabaña en Huasca de Ocampo`}
                    className="h-52 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="h-52 w-full bg-cream" />
                )}
                {p.for_sale && <ForSaleBadge className="top-3 left-3 w-16" />}
                <div className="p-5">
                  <h3 className="font-display text-xl text-navy-deep">{p.name}</h3>
                  <p className="text-sm text-stone mt-1.5">
                    Hasta {p.capacity} huéspedes · {p.bedrooms} {p.bedrooms === 1 ? 'recámara' : 'recámaras'}
                  </p>
                  {tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {tags.map((t) => (
                        <span key={t} className="rounded-full bg-cream px-2.5 py-1 text-[11px] text-navy-deep">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-sm text-navy-deep mt-4 font-medium">
                    Desde ${p.weekday_price_mxn.toLocaleString('es-MX')} MXN <span className="text-stone font-normal">por noche</span>
                  </p>
                  {p.booking_mode === 'whatsapp' && (
                    <p className="text-xs text-[#128C7E] mt-1.5 font-medium">Consulta disponibilidad por WhatsApp</p>
                  )}
                </div>
              </Link>
            )
          })}
        </div>

        <section className="mt-14">
          <h2 className="font-display text-2xl sm:text-3xl text-navy-deep mb-5">Preguntas frecuentes</h2>
          <div className="space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="rounded-2xl border border-stone/10 bg-white p-4 sm:p-5 group">
                <summary className="cursor-pointer font-medium text-navy-deep list-none flex justify-between gap-3">
                  {f.q}
                  <span className="text-gold group-open:rotate-45 transition">+</span>
                </summary>
                <p className="mt-3 text-sm text-stone leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-4 text-sm text-stone">
            Consulta también nuestras{' '}
            <Link href="/politicas" className="text-gold underline underline-offset-2">políticas</Link>, el{' '}
            <Link href="/reglamento" className="text-gold underline underline-offset-2">reglamento</Link> y los{' '}
            <Link href="/extras" className="text-gold underline underline-offset-2">extras</Link> para tu estancia.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-xl text-navy-deep mb-4">Explora más cabañas en Huasca de Ocampo</h2>
          <div className="flex flex-wrap gap-2">
            {related.map((l) => (
              <Link
                key={l.slug}
                href={`/${l.slug}`}
                className="rounded-full border border-stone/20 bg-white px-4 py-2 text-sm text-navy-deep hover:border-gold transition"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
