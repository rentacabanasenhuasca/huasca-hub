import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireHost } from '@/lib/hosts'
import { optimizedImage } from '@/lib/media'
import { formatPrice, type SaleStatus } from '@/lib/sale-listings'

const STATUS_BADGE: Record<SaleStatus, { label: string; cls: string }> = {
  draft: { label: 'Borrador', cls: 'bg-stone/15 text-stone' },
  published: { label: 'En venta', cls: 'bg-emerald-50 text-emerald-700' },
  sold: { label: 'Vendida', cls: 'bg-burnt-orange/15 text-burnt-orange' },
}

export default async function VentasPage() {
  const host = await requireHost()
  const supabase = await createClient()

  const { data: listings } = await supabase
    .from('sale_listings')
    .select('id, slug, title, status, price_mxn, location')
    .eq('host_id', host.id)
    .order('sort_order')
    .order('created_at', { ascending: false })

  const ids = (listings ?? []).map((l) => l.id)
  const { data: media } =
    ids.length > 0
      ? await supabase
          .from('sale_listing_media')
          .select('listing_id, url, kind, sort_order')
          .in('listing_id', ids)
          .eq('kind', 'image')
          .order('sort_order')
      : { data: [] as { listing_id: string; url: string }[] }
  const cover = new Map<string, string>()
  for (const m of media ?? []) if (!cover.has(m.listing_id)) cover.set(m.listing_id, m.url)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-navy-deep">Casas en venta</h1>
          <p className="text-sm text-stone mt-1">
            Cada casa tiene su propia página para compartir. Listado público:{' '}
            <a href="/en-venta" target="_blank" rel="noopener noreferrer" className="text-gold underline underline-offset-2">
              huascaretreats.com/en-venta
            </a>
          </p>
        </div>
        <Link href="/admin/ventas/nueva" className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-cream hover:bg-navy-deep transition">
          + Nueva casa en venta
        </Link>
      </div>

      {!listings || listings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone/30 bg-white p-10 text-center text-stone">
          Aún no tienes casas en venta. Crea la primera con el botón de arriba.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => {
            const badge = STATUS_BADGE[l.status as SaleStatus] ?? STATUS_BADGE.draft
            return (
              <div key={l.id} className="rounded-xl border border-stone/15 bg-white overflow-hidden">
                <Link href={`/admin/ventas/${l.id}`} className="block">
                  {cover.get(l.id) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={optimizedImage(cover.get(l.id), 640)} alt="" className="h-40 w-full object-cover" />
                  ) : (
                    <div className="h-40 w-full bg-cream flex items-center justify-center text-xs text-stone">Sin foto</div>
                  )}
                </Link>
                <div className="p-4 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/admin/ventas/${l.id}`} className="font-medium text-navy-deep hover:underline">
                      {l.title}
                    </Link>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.cls}`}>{badge.label}</span>
                  </div>
                  {l.location && <p className="text-xs text-stone">{l.location}</p>}
                  <p className="text-sm text-navy-deep">{formatPrice(l.price_mxn) ?? 'Precio sin publicar'}</p>
                  <div className="flex gap-3 pt-1 text-xs">
                    <Link href={`/admin/ventas/${l.id}`} className="text-gold underline underline-offset-2">
                      Editar
                    </Link>
                    {l.status !== 'draft' && (
                      <a href={`/en-venta/${l.slug}`} target="_blank" rel="noopener noreferrer" className="text-gold underline underline-offset-2">
                        Ver página
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
