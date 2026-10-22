import type { Metadata } from 'next'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/service'
import { optimizedImage } from '@/lib/media'
import { formatPrice } from '@/lib/sale-listings'
import { SITE_URL } from '@/lib/site'
import SaleHeader from '@/components/SaleHeader'
import SiteFooter from '@/components/SiteFooter'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Casas en venta en Huasca de Ocampo',
  description: 'Casas y cabañas en venta en Huasca de Ocampo, Hidalgo. Fotos, videos, precio y características de cada propiedad.',
  alternates: { canonical: `${SITE_URL}/en-venta` },
}

export default async function EnVentaPage() {
  const supabase = createServiceClient()
  const { data: listings } = await supabase
    .from('sale_listings')
    .select('id, slug, title, status, price_mxn, price_note, location, summary, bedrooms, bathrooms, built_m2, land_m2')
    .in('status', ['published', 'sold'])
    .order('status')
    .order('sort_order')
    .order('created_at', { ascending: false })

  const ids = (listings ?? []).map((l) => l.id)
  const { data: media } =
    ids.length > 0
      ? await supabase.from('sale_listing_media').select('listing_id, url').in('listing_id', ids).eq('kind', 'image').order('sort_order')
      : { data: [] as { listing_id: string; url: string }[] }
  const cover = new Map<string, string>()
  for (const m of media ?? []) if (!cover.has(m.listing_id)) cover.set(m.listing_id, m.url)

  return (
    <div className="font-body min-h-full bg-cream">
      <SaleHeader backHref="/" backLabel="Cabañas en renta" />
      <header className="max-w-3xl mx-auto px-4 pt-14 sm:pt-20 pb-8 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-gold">Huasca de Ocampo, Hidalgo</p>
        <h1 className="font-display text-3xl sm:text-5xl text-navy-deep mt-3">Casas en venta</h1>
        <p className="text-stone mt-4">Propiedades seleccionadas en el Pueblo Mágico. Escríbenos para agendar una visita.</p>
      </header>

      <main className="max-w-5xl mx-auto px-4 pb-10">
        {!listings || listings.length === 0 ? (
          <p className="text-center text-stone py-16">Por ahora no hay casas en venta. Vuelve pronto.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {listings.map((l) => {
              const sold = l.status === 'sold'
              const specs = [
                l.bedrooms != null && `${l.bedrooms} recámaras`,
                l.bathrooms != null && `${l.bathrooms} baños`,
                l.built_m2 != null && `${l.built_m2} m² construidos`,
              ].filter(Boolean)
              return (
                <Link key={l.id} href={`/en-venta/${l.slug}`} className="group block overflow-hidden rounded-2xl bg-white border border-stone/10 shadow-sm hover:shadow-md transition">
                  <div className="relative aspect-[4/3] bg-stone/10">
                    {cover.get(l.id) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={optimizedImage(cover.get(l.id), 828)} alt={l.title} className={`h-full w-full object-cover group-hover:scale-[1.02] transition ${sold ? 'grayscale-[40%]' : ''}`} />
                    )}
                    <span className={`absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-semibold ${sold ? 'bg-navy-deep text-cream' : 'bg-burnt-orange text-white'}`}>
                      {sold ? 'Vendida' : 'En venta'}
                    </span>
                  </div>
                  <div className="p-5">
                    <h2 className="font-display text-xl text-navy-deep">{l.title}</h2>
                    {l.location && <p className="text-xs text-stone mt-1">{l.location}</p>}
                    {specs.length > 0 && <p className="text-sm text-stone mt-2">{specs.join(' · ')}</p>}
                    <p className="mt-3 text-lg font-semibold text-navy-deep">
                      {sold ? 'Vendida' : formatPrice(l.price_mxn) ?? 'Precio a consultar'}
                    </p>
                    {!sold && l.price_note && <p className="text-xs text-stone">{l.price_note}</p>}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
