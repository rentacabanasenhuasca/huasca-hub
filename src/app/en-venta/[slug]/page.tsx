import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { optimizedImage } from '@/lib/media'
import { formatPrice, videoEmbedUrl, whatsappDigits, type SaleListing, type SaleMedia } from '@/lib/sale-listings'
import { SITE_URL, SITE_NAME } from '@/lib/site'
import PhotoGallery from '@/components/PhotoGallery'
import SaleHeader from '@/components/SaleHeader'
import SiteFooter from '@/components/SiteFooter'

export const revalidate = 300

async function loadListing(slug: string) {
  const supabase = createServiceClient()
  const { data: listing } = await supabase
    .from('sale_listings')
    .select('*')
    .eq('slug', slug)
    .in('status', ['published', 'sold'])
    .maybeSingle()
  if (!listing) return null
  const [{ data: media }, { data: host }] = await Promise.all([
    supabase.from('sale_listing_media').select('kind, url, caption, sort_order').eq('listing_id', listing.id).order('sort_order'),
    supabase.from('hosts').select('phone').eq('id', listing.host_id).maybeSingle(),
  ])
  return { listing: listing as SaleListing, media: (media ?? []) as SaleMedia[], hostPhone: (host?.phone as string | null) ?? null }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const data = await loadListing(slug)
  if (!data) return { title: 'Casa no encontrada' }
  const { listing, media } = data
  const price = formatPrice(listing.price_mxn)
  const title = `${listing.title}${listing.status === 'sold' ? ' (vendida)' : price ? ` · ${price}` : ''}`
  const description = (listing.summary || listing.description || `Casa en venta en ${listing.location ?? 'Huasca de Ocampo'}`).slice(0, 160)
  const image = media.find((m) => m.kind === 'image')?.url
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/en-venta/${listing.slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/en-venta/${listing.slug}`,
      siteName: SITE_NAME,
      type: 'website',
      images: image ? [{ url: image }] : undefined,
    },
  }
}

export default async function CasaEnVentaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await loadListing(slug)
  if (!data) notFound()
  const { listing, media, hostPhone } = data

  const sold = listing.status === 'sold'
  const images = media.filter((m) => m.kind === 'image')
  const videos = media.filter((m) => m.kind === 'video')
  const embed = videoEmbedUrl(listing.video_url)
  const price = formatPrice(listing.price_mxn)
  const pageUrl = `${SITE_URL}/en-venta/${listing.slug}`
  const wa = whatsappDigits(listing.contact_whatsapp || hostPhone)
  const waHref = wa
    ? `https://wa.me/${wa}?text=${encodeURIComponent(`Hola, me interesa la casa en venta "${listing.title}": ${pageUrl}`)}`
    : null

  const specs: { label: string; value: string }[] = [
    listing.bedrooms != null && { label: 'Recámaras', value: String(listing.bedrooms) },
    listing.bathrooms != null && {
      label: 'Baños',
      value: Number(listing.bathrooms) % 1 ? `${Math.floor(Number(listing.bathrooms))} y medio` : String(listing.bathrooms),
    },
    listing.built_m2 != null && { label: 'Construcción', value: `${listing.built_m2} m²` },
    listing.land_m2 != null && { label: 'Terreno', value: `${listing.land_m2} m²` },
    listing.parking != null && { label: 'Estacionamiento', value: `${listing.parking} autos` },
  ].filter(Boolean) as { label: string; value: string }[]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: listing.title,
    url: pageUrl,
    description: listing.summary || listing.description || undefined,
    image: images.slice(0, 6).map((m) => m.url),
    offers:
      listing.price_mxn != null && !sold
        ? { '@type': 'Offer', price: listing.price_mxn, priceCurrency: 'MXN', availability: 'https://schema.org/InStock' }
        : undefined,
  }

  return (
    <div className="font-body min-h-full bg-cream">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SaleHeader backHref="/en-venta" backLabel="Casas en venta" />

      <header className="max-w-5xl mx-auto px-4 pt-12 sm:pt-16 pb-6">
        <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${sold ? 'bg-navy-deep text-cream' : 'bg-burnt-orange text-white'}`}>
          {sold ? 'Vendida' : 'En venta'}
        </span>
        <h1 className="font-display text-3xl sm:text-5xl text-navy-deep mt-3">{listing.title}</h1>
        {listing.location && <p className="text-stone mt-2">{listing.location}</p>}
      </header>

      <div className="max-w-5xl mx-auto px-4">
        <PhotoGallery
          photos={images.map((m) => ({ url: m.url, category: null, description: m.caption }))}
          alt={listing.title}
          forSale={!sold}
        />
      </div>

      <main className="max-w-5xl mx-auto px-4 py-10 grid gap-10 lg:grid-cols-[1fr_320px]">
        <div className="space-y-10 min-w-0">
          {listing.summary && <p className="text-lg text-navy-deep leading-relaxed">{listing.summary}</p>}

          {specs.length > 0 && (
            <section>
              <h2 className="font-display text-2xl text-navy-deep mb-4">Características</h2>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {specs.map((s) => (
                  <div key={s.label} className="rounded-xl bg-white border border-stone/10 p-4">
                    <dt className="text-xs text-stone">{s.label}</dt>
                    <dd className="text-lg font-semibold text-navy-deep mt-1">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {listing.description && (
            <section>
              <h2 className="font-display text-2xl text-navy-deep mb-4">Descripción</h2>
              <p className="text-navy-deep/90 leading-relaxed whitespace-pre-line text-justify">{listing.description}</p>
            </section>
          )}

          {listing.features?.length > 0 && (
            <section>
              <h2 className="font-display text-2xl text-navy-deep mb-4">Lo que incluye</h2>
              <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                {listing.features.map((f) => (
                  <li key={f} className="flex gap-2 text-navy-deep/90">
                    <span className="text-gold" aria-hidden>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(embed || videos.length > 0) && (
            <section>
              <h2 className="font-display text-2xl text-navy-deep mb-4">Videos</h2>
              <div className="space-y-4">
                {embed && (
                  <div className="aspect-video overflow-hidden rounded-2xl bg-black">
                    <iframe
                      src={embed}
                      title={`Video de ${listing.title}`}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
                {videos.map((v) => (
                  <figure key={v.url}>
                    <video src={v.url} controls preload="metadata" playsInline className="w-full rounded-2xl bg-black" />
                    {v.caption && <figcaption className="text-xs text-stone mt-1">{v.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            </section>
          )}

          {images.length > 0 && (
            <section>
              <h2 className="font-display text-2xl text-navy-deep mb-4">Todas las fotos</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {images.map((m, i) => (
                  <a key={m.url} href={m.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={optimizedImage(m.url, 640)} alt={m.caption || `${listing.title} — foto ${i + 1}`} loading="lazy" className="aspect-[4/3] w-full object-cover hover:scale-[1.03] transition" />
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-32 h-fit rounded-2xl bg-white border border-stone/10 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-stone">Precio de venta</p>
          <p className="font-display text-3xl text-navy-deep mt-1">{sold ? 'Vendida' : price ?? 'A consultar'}</p>
          {!sold && listing.price_note && <p className="text-sm text-stone mt-1">{listing.price_note}</p>}
          {!sold && waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3 font-semibold text-white hover:brightness-95 transition"
            >
              Me interesa · WhatsApp
            </a>
          )}
          {listing.google_maps_link && (
            <a href={listing.google_maps_link} target="_blank" rel="noopener noreferrer" className="mt-3 block text-center text-sm text-gold underline underline-offset-2">
              Ver ubicación en el mapa
            </a>
          )}
          <p className="mt-4 text-xs text-stone text-center">Agenda una visita sin compromiso.</p>
        </aside>
      </main>

      <SiteFooter />
    </div>
  )
}
