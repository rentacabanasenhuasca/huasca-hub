import Link from 'next/link'
import Image from 'next/image'
import { createServiceClient } from '@/lib/supabase/service'
import { recomputeCalendarRange, nightsBetween, isWeekendNight } from '@/lib/calendar'
import { parseGuestsFromParams, fitsProperty, extraGuestsFor, guestsSummary } from '@/lib/occupancy'
import CompactSearchForm from '@/components/CompactSearchForm'
import ShareSearchLink from '@/components/ShareSearchLink'
import PublicAvailabilityGrid from '@/components/PublicAvailabilityGrid'
import HeroCarousel from '@/components/HeroCarousel'
import SiteFooter from '@/components/SiteFooter'

// Cuántos días hacia adelante se muestran en el calendario de disponibilidad
// de todas las propiedades, al pie de la página de inicio.
const AVAILABILITY_WINDOW_DAYS = 120

type PublicProperty = {
  id: string
  name: string
  capacity: number
  bedrooms: number
  bathrooms: number
  weekday_price_mxn: number
  weekend_price_mxn: number
  base_occupancy: number
  extra_guest_fee_mxn: number
  min_nights: number
  pet_friendly: boolean
  max_children: number | null
  max_infants: number | null
  infants_count_toward_capacity: boolean
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    checkin?: string
    checkout?: string
    guests?: string
    adults?: string
    children?: string
    infants?: string
    pets?: string
  }>
}) {
  const sp = await searchParams
  const { checkin, checkout } = sp
  const guests = parseGuestsFromParams(sp)
  const hasSearch = Boolean(checkin && checkout && checkout > checkin)

  const supabase = createServiceClient()

  const { data: properties } = await supabase
    .from('properties')
    .select(
      'id, host_id, name, capacity, bedrooms, bathrooms, weekday_price_mxn, weekend_price_mxn, base_occupancy, extra_guest_fee_mxn, min_nights, pet_friendly, max_children, max_infants, infants_count_toward_capacity'
    )
    .eq('status', 'published')
    .order('name')

  const typedProperties = (properties ?? []) as (PublicProperty & { host_id: string })[]
  const propertyIds = typedProperties.map((p) => p.id)
  // El anfitrión "real": el dueño de las propiedades publicadas. Sirve para
  // filtrar la portada (hero_media) — si por alguna razón llegara a existir
  // más de una fila en `hosts` (por ejemplo de una sesión de prueba vieja),
  // esto evita que se cuelen fotos/videos de un host distinto al del sitio.
  const hostId = typedProperties[0]?.host_id ?? null

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

  // Portada: fotos y/o video que el host sube desde /admin/portada. Si no
  // hay nada configurado, el hero se queda como el fondo sólido de siempre.
  // Filtrado por host_id (ver arriba) para no mostrar filas huérfanas de
  // otro host si llegara a haber alguno.
  const { data: heroMedia } = hostId
    ? await supabase
        .from('hero_media')
        .select('id, media_type, url')
        .eq('enabled', true)
        .eq('host_id', hostId)
        .order('sort_order', { ascending: true })
    : { data: [] as { id: string; media_type: 'image' | 'video'; url: string }[] }

  // Calendario de disponibilidad de todas las cabañas (verde/naranja), al
  // pie de la página — independiente de si ya se hizo una búsqueda.
  const availabilityStart = todayStr()
  const availabilityEnd = (() => {
    const d = new Date(`${availabilityStart}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + AVAILABILITY_WINDOW_DAYS)
    return d.toISOString().slice(0, 10)
  })()
  const { data: availabilityBlocked } =
    propertyIds.length > 0
      ? await supabase
          .from('blocked_dates')
          .select('property_id, date')
          .in('property_id', propertyIds)
          .gte('date', availabilityStart)
          .lte('date', availabilityEnd)
      : { data: [] as { property_id: string; date: string }[] }

  let nights: string[] = []
  const dayMapByProperty = new Map<string, Map<string, { price_mxn: number; extra_guest_fee_mxn: number; min_nights: number }>>()
  const blockedByProperty = new Map<string, Set<string>>()

  if (hasSearch && propertyIds.length > 0) {
    nights = nightsBetween(checkin!, checkout!)
    const lastNight = nights[nights.length - 1]
    // Recalcula bajo demanda: garantiza que calendar_days tenga estas
    // fechas aunque el host nunca las haya abierto en su calendario.
    await recomputeCalendarRange(supabase, propertyIds, checkin!, lastNight)

    const [{ data: days }, { data: blocked }] = await Promise.all([
      supabase
        .from('calendar_days')
        .select('property_id, date, price_mxn, extra_guest_fee_mxn, min_nights')
        .in('property_id', propertyIds)
        .gte('date', checkin!)
        .lte('date', lastNight),
      supabase
        .from('blocked_dates')
        .select('property_id, date')
        .in('property_id', propertyIds)
        .gte('date', checkin!)
        .lte('date', lastNight),
    ])

    for (const d of days ?? []) {
      if (!dayMapByProperty.has(d.property_id)) dayMapByProperty.set(d.property_id, new Map())
      dayMapByProperty.get(d.property_id)!.set(d.date, d)
    }
    for (const b of blocked ?? []) {
      if (!blockedByProperty.has(b.property_id)) blockedByProperty.set(b.property_id, new Set())
      blockedByProperty.get(b.property_id)!.add(b.date)
    }
  }

  const results = typedProperties
    .map((property) => {
      const fitsGuests = fitsProperty(property, guests)
      if (!hasSearch) {
        return { property, total: null as number | null, minNightsOk: true, fitsGuests, isFree: true }
      }

      const dayMap = dayMapByProperty.get(property.id)
      const blockedDates = blockedByProperty.get(property.id)
      const extraGuests = extraGuestsFor(property, guests)
      let total = 0
      let minNightsRequired = property.min_nights
      let isFree = true

      for (const date of nights) {
        if (blockedDates?.has(date)) isFree = false
        const cd = dayMap?.get(date)
        if (cd) {
          total += Number(cd.price_mxn) + Number(cd.extra_guest_fee_mxn) * extraGuests
          minNightsRequired = Math.max(minNightsRequired, cd.min_nights)
        } else {
          const base = isWeekendNight(date) ? property.weekend_price_mxn : property.weekday_price_mxn
          total += Number(base) + Number(property.extra_guest_fee_mxn) * extraGuests
        }
      }

      return {
        property,
        total,
        minNightsOk: nights.length >= minNightsRequired,
        fitsGuests,
        isFree,
      }
    })
    .filter((r) => r.fitsGuests && r.minNightsOk && r.isFree)

  return (
    <div className="font-body min-h-full bg-cream">
      {/* Nav flotante — con el buscador compacto siempre a la mano, no
          solo el que está grande en el hero (ver más abajo). */}
      <div className="sticky top-4 z-30 px-4">
        <div className="max-w-5xl mx-auto flex flex-col gap-3 rounded-[28px] border border-stone/10 bg-white/90 backdrop-blur-md px-5 py-3 shadow-[0_1px_3px_rgba(16,27,40,0.08)] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-2 sm:pr-2.5">
          <div className="flex items-center justify-between sm:contents">
            <Link
              href="/admin"
              className="sm:order-1 shrink-0 rounded-full bg-navy text-cream text-xs font-medium px-4 py-2 hover:bg-navy-deep transition"
            >
              Panel de anfitrión
            </Link>
            <Link href="/" aria-label="Huasca Retreats" className="sm:order-3 shrink-0">
              <Image
                src="/logo.png"
                alt="Huasca Retreats"
                width={800}
                height={750}
                priority
                className="h-20 w-auto sm:h-24 drop-shadow-md"
              />
            </Link>
          </div>
          <div className="sm:order-2">
            <CompactSearchForm defaultCheckin={checkin} defaultCheckout={checkout} defaultGuests={guests} />
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-navy via-navy to-navy-deep" />
        {/* Si el host subió fotos/video en /admin/portada, se ven aquí como
            carrusel de fondo (con su propio oscurecido para legibilidad).
            Si no hay nada configurado, no renderiza nada y se ve el fondo
            sólido de siempre. */}
        <HeroCarousel items={heroMedia ?? []} />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 20%, var(--gold) 0%, transparent 42%), radial-gradient(circle at 82% 0%, var(--gold-light) 0%, transparent 38%)',
          }}
        />
        <div className="relative max-w-3xl mx-auto px-4 pt-24 pb-32 sm:pt-32 sm:pb-40 text-center">
          <p className="animate-fade-up text-xs sm:text-sm tracking-[0.3em] uppercase text-gold mb-5">
            Huasca de Ocampo, Hidalgo
          </p>
          <h1
            className="animate-fade-up font-display font-black text-4xl sm:text-6xl lg:text-7xl text-cream leading-[1.05]"
            style={{ animationDelay: '80ms' }}
          >
            Cabañas y casas
            <br className="hidden sm:block" /> entre bosque y niebla
          </h1>
          <p
            className="animate-fade-up mt-6 text-cream/70 text-base sm:text-lg max-w-xl mx-auto"
            style={{ animationDelay: '160ms' }}
          >
            Busca tus fechas y ve el precio total al instante, sin sorpresas.
          </p>
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-4 pt-16 sm:pt-20">
        <div className="pb-8">
          {!properties || properties.length === 0 ? (
            <p className="text-stone text-sm">Todavía no hay cabañas publicadas.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-3 mb-5">
                <h2 className="font-display text-2xl sm:text-3xl text-navy-deep">
                  {hasSearch ? 'Disponibles para tus fechas' : 'Nuestras cabañas'}
                </h2>
                {hasSearch && (
                  <p className="text-sm text-stone">
                    {results.length} {results.length === 1 ? 'opción' : 'opciones'} · {nights.length}{' '}
                    {nights.length === 1 ? 'noche' : 'noches'} · {guestsSummary(guests)}
                  </p>
                )}
              </div>
              {hasSearch && (
                <div className="mb-6 -mt-2">
                  <ShareSearchLink />
                </div>
              )}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {results.map(({ property, total }) => {
                  const query = new URLSearchParams()
                  if (checkin) query.set('checkin', checkin)
                  if (checkout) query.set('checkout', checkout)
                  query.set('adults', String(guests.adults))
                  query.set('children', String(guests.children))
                  query.set('infants', String(guests.infants))
                  query.set('pets', String(guests.pets))

                  return (
                    <Link
                      key={property.id}
                      href={`/cabanas/${property.id}?${query.toString()}`}
                      className="group block rounded-3xl border border-stone/10 bg-white overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-navy-deep/10"
                    >
                      {coverByProperty.get(property.id) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={coverByProperty.get(property.id)}
                          alt={property.name}
                          className="h-52 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="h-52 w-full bg-cream flex items-center justify-center text-stone text-xs">
                          Sin foto
                        </div>
                      )}
                      <div className="p-5">
                        <h3 className="font-display text-xl text-navy-deep">{property.name}</h3>
                        <p className="text-sm text-stone mt-1.5">
                          Hasta {property.capacity} huéspedes · {property.bedrooms} recámaras
                          {property.pet_friendly ? ' · Pet friendly' : ''}
                        </p>
                        <p className="text-sm text-navy-deep mt-4 font-medium">
                          {total != null ? (
                            <>
                              ${Math.round(total).toLocaleString('es-MX')} MXN{' '}
                              <span className="text-stone font-normal">
                                total · {nights.length} {nights.length === 1 ? 'noche' : 'noches'}
                              </span>
                            </>
                          ) : (
                            <>
                              Desde ${Number(property.weekday_price_mxn).toLocaleString('es-MX')} MXN{' '}
                              <span className="text-stone font-normal">por noche</span>
                            </>
                          )}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
              {hasSearch && results.length === 0 && (
                <p className="text-stone text-sm">
                  No hay cabañas disponibles para esas fechas/huéspedes. Prueba con otras fechas.
                </p>
              )}
            </>
          )}
        </div>

        {properties && properties.length > 0 && (
          <div className="py-12">
            <h2 className="font-display text-2xl sm:text-3xl text-navy-deep mb-5">Calendario de disponibilidad</h2>
            <div className="rounded-3xl border border-stone/10 bg-white p-4 sm:p-6 shadow-sm">
              <PublicAvailabilityGrid
                properties={typedProperties.map((p) => ({
                  id: p.id,
                  name: p.name,
                  cover_photo_url: coverByProperty.get(p.id) ?? null,
                }))}
                windowStart={availabilityStart}
                windowEnd={availabilityEnd}
                blockedDates={availabilityBlocked ?? []}
              />
            </div>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}
