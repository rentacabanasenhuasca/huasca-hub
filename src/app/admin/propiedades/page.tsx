import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireHost } from '@/lib/hosts'

export default async function PropiedadesPage() {
  const host = await requireHost()
  const supabase = await createClient()

  const { data: properties } = await supabase
    .from('properties')
    .select('id, name, status, capacity, bedrooms, weekday_price_mxn, weekend_price_mxn, pet_friendly')
    .eq('host_id', host.id)
    .order('created_at', { ascending: false })

  const propertyIds = (properties ?? []).map((p) => p.id)
  const { data: photos } =
    propertyIds.length > 0
      ? await supabase
          .from('property_photos')
          .select('property_id, url, sort_order')
          .in('property_id', propertyIds)
          .order('sort_order', { ascending: true })
      : { data: [] as { property_id: string; url: string; sort_order: number }[] }

  const coverByProperty = new Map<string, string>()
  for (const photo of photos ?? []) {
    if (!coverByProperty.has(photo.property_id)) coverByProperty.set(photo.property_id, photo.url)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-navy-deep">Tus propiedades</h1>
        <Link
          href="/admin/propiedades/nueva"
          className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-cream hover:bg-navy-deep transition"
        >
          + Nueva propiedad
        </Link>
      </div>

      {!properties || properties.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone/30 bg-white p-10 text-center text-stone">
          Aún no tienes propiedades. Crea la primera para empezar a recibir reservas.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <Link
              key={p.id}
              href={`/admin/propiedades/${p.id}`}
              className="block rounded-xl border border-stone/15 bg-white overflow-hidden hover:shadow-md hover:border-gold/50 transition"
            >
              {coverByProperty.get(p.id) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverByProperty.get(p.id)}
                  alt=""
                  className="h-40 w-full object-cover"
                />
              ) : (
                <div className="h-40 w-full bg-cream flex items-center justify-center text-stone text-xs">
                  Sin foto
                </div>
              )}
              <div className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <h2 className="font-medium text-navy-deep">{p.name}</h2>
                  <span
                    className={`text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 font-medium ${
                      p.status === 'published'
                        ? 'bg-olive-deep/10 text-olive-deep'
                        : 'bg-stone/10 text-stone'
                    }`}
                  >
                    {p.status === 'published' ? 'Publicada' : 'Borrador'}
                  </span>
                </div>
                <p className="text-sm text-stone mb-3">
                  {p.capacity} huéspedes · {p.bedrooms} recámaras {p.pet_friendly ? '· Pet friendly' : ''}
                </p>
                <p className="text-sm text-navy-deep">
                  ${Number(p.weekday_price_mxn).toLocaleString('es-MX')} entre semana ·{' '}
                  ${Number(p.weekend_price_mxn).toLocaleString('es-MX')} fin de semana
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
