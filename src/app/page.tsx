import Link from 'next/link'
import Image from 'next/image'
import { createServiceClient } from '@/lib/supabase/service'
import { recomputeCalendarRange, nightsBetween, isWeekendNight } from '@/lib/calendar'
import { parseGuestsFromParams, fitsProperty, occupantsFor, guestsSummary } from '@/lib/occupancy'
import CompactSearchForm from '@/components/CompactSearchForm'
import ShareSearchLink from '@/components/ShareSearchLink'
import PublicAvailabilityGrid from '@/components/PublicAvailabilityGrid'
import HeroCarousel from '@/components/HeroCarousel'
import SiteFooter from '@/components/SiteFooter'
import ForSaleBadge from '@/components/ForSaleBadge'
import type { Metadata } from 'next'
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '@/lib/site'
import { todayInMexicoStr } from '@/lib/dates'
import { optimizedImage } from '@/lib/media'
import { LANDINGS, GENERAL_FAQS } from '@/lib/seo-landings'

// Cuántos días hacia adelante se muestran en el calendario de disponibilidad
// de todas las propiedades, al pie de la página de inicio.
const AVAILABILITY_WINDOW_DAYS = 120

type PublicProperty = {
  id: string
  slug: string
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

export const metadata: Metadata = {
  title: { absolute: `Cabañas en Huasca de Ocampo con jacuzzi, chimenea y glamping | ${SITE_NAME}` },
  description:
    'Renta de cabañas en Huasca de Ocampo, Hidalgo, a 2 horas de la CDMX: jacuzzi privado, chimenea, techo de cristal y pet friendly. Reserva directo, sin comisiones.',
  alternates: { canonical: '/' },
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
    jacuzzi?: string
  }>
}) {
  const sp = await searchParams
  const { checkin, checkout } = sp
  const guests = parseGuestsFromParams(sp)
  const hasSearch = Boolean(checkin && checkout && checkout > checkin)
  const jacuzziOnly = sp.jacuzzi === '1'

  const supabase = createServiceClient()

  const { data: properties } = await supabase
    .from('properties')
    .select(
      'id, host_id, name, slug, capacity, bedrooms, bathrooms, weekday_price_mxn, weekend_price_mxn, base_occupancy, extra_guest_fee_mxn, min_nights, pet_friendly, max_children, max_infants, infants_count_toward_capacity, booking_mode, for_sale'
    )
    .eq('status', 'published')
    .order('name')

  const typedProperties = (properties ?? []) as (PublicProperty & { host_id: string; booking_mode: string | null; for_sale: boolean | null })[]
  const propertyIds = typedProperties.map((p) => p.id)
  // El anfitrión "real": el dueño de las propiedades publicadas. Sirve para
  // filtrar la portada (hero_media) — si por alguna razón llegara a existir
  // más de una fila en `hosts` (por ejemplo de una sesión de prueba vieja),
  // esto evita que se cuelen fotos/videos de un host distinto al del sitio.
  const hostId = typedProperties[0]?.host_id ?? null

  // WhatsApp del anfitrión, para el mensaje de "sin disponibilidad".
  const { data: hostContact } = hostId
    ? await supabase.from('hosts').select('phone').eq('id', hostId).maybeSingle()
    : { data: null as { phone: string | null } | null }

  // Casas en venta: si hay alguna publicada, se muestra un aviso con link a
  // /en-venta (con la foto de portada de la primera).
  const { data: saleListings } = await supabase
    .from('sale_listings')
    .select('id')
    .eq('status', 'published')
    .order('sort_order')
    .order('created_at', { ascending: false })
  const saleCount = saleListings?.length ?? 0
  const { data: saleCover } =
    saleCount > 0
      ? await supabase
          .from('sale_listing_media')
          .select('url')
          .eq('listing_id', saleListings![0].id)
          .eq('kind', 'image')
          .order('sort_order')
          .limit(1)
          .maybeSingle()
      : { data: null as { url: string } | null }

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

  // Qué propiedades tienen la amenidad "Jacuzzi" — para el filtro rápido del
  // buscador (mismo patrón que Airbnb: un chip que reduce los resultados a
  // las cabañas con esa amenidad). Solo se consulta si hace falta, para no
  // pagar este join en cada carga de la portada.
  const jacuzziPropertyIds = new Set<string>()
  if (jacuzziOnly && propertyIds.length > 0) {
    const { data: jacuzziRows } = await supabase
      .from('property_amenities')
      .select('property_id, amenities!inner(label)')
      .in('property_id', propertyIds)
      .ilike('amenities.label', 'jacuzzi')
    for (const row of jacuzziRows ?? []) jacuzziPropertyIds.add(row.property_id)
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
  const availabilityStart = todayInMexicoStr()
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
  const minGuestsByProperty = new Map<string, Map<string, number>>()

  if (hasSearch && propertyIds.length > 0) {
    nights = nightsBetween(checkin!, checkout!)
    const lastNight = nights[nights.length - 1]
    // Recalcula bajo demanda: garantiza que calendar_days tenga estas
    // fechas aunque el host nunca las haya abierto en su calendario.
    await recomputeCalendarRange(supabase, propertyIds, checkin!, lastNight)

    const [{ data: days }, { data: blocked }, { data: minGuestRows }] = await Promise.all([
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
      supabase
        .from('min_guests_overrides')
        .select('property_id, date, min_guests')
        .in('property_id', propertyIds)
        .gte('date', checkin!)
        .lte('date', lastNight),
    ])

    for (const r of minGuestRows ?? []) {
      if (!minGuestsByProperty.has(r.property_id)) minGuestsByProperty.set(r.property_id, new Map())
      minGuestsByProperty.get(r.property_id)!.set(r.date, Number(r.min_guests))
    }

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
      // Las cabañas "solo por WhatsApp" no muestran precio total ni se filtran
      // por disponibilidad: el huésped pregunta por WhatsApp.
      if (!hasSearch) {
        return { property, total: null as number | null, minNightsOk: true, minNightsRequired: 1, fitsGuests, isFree: true }
      }
      if (property.booking_mode === 'whatsapp') {
        // Sin precio en línea, pero sí respetan las fechas ocupadas: si ya
        // está bloqueada en esas fechas, no aparece como disponible.
        const taken = blockedByProperty.get(property.id)
        const isFree = !nights.some((d) => taken?.has(d))
        return { property, total: null as number | null, minNightsOk: true, minNightsRequired: 1, fitsGuests, isFree }
      }

      const dayMap = dayMapByProperty.get(property.id)
      const blockedDates = blockedByProperty.get(property.id)
      const occupants = occupantsFor(property, guests)
      const minGuestsMap = minGuestsByProperty.get(property.id)
      let total = 0
      let minNightsRequired = property.min_nights
      let isFree = true

      for (const date of nights) {
        if (blockedDates?.has(date)) isFree = false
        // Cobro mínimo por personas en esa noche (si lo hay).
        const minGuests = Math.min(minGuestsMap?.get(date) ?? 0, property.capacity)
        const extraGuests = Math.max(0, Math.max(occupants, minGuests) - property.base_occupancy)
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
        minNightsRequired,
        fitsGuests,
        isFree,
      }
    })
    // Las cabañas libres que no cumplen el mínimo de noches NO se ocultan:
    // se muestran con la leyenda "Selecciona mínimo N noches" (ver tarjeta).
    .filter((r) => r.fitsGuests && r.isFree)
    .filter((r) => !jacuzziOnly || jacuzziPropertyIds.has(r.property.id))

    // Barajamos el orden en el que se muestran las tarjetas: sin esto, como la
    // consulta viene ordenada por nombre, propiedades con nombres parecidos
    // (p.ej. las dos "Glasshouse") siempre salían juntas. Fisher-Yates in situ;
    // se recalcula en cada carga de la página (es un Server Component), así
    // que el orden cambia entre visitas pero es el mismo durante una misma carga.
    for (let i = results.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[results[i], results[j]] = [results[j], results[i]]
    }

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: GENERAL_FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    image: `${SITE_URL}/logo.png`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Huasca de Ocampo',
      addressRegion: 'Hidalgo',
      addressCountry: 'MX',
    },
    makesOffer: typedProperties.map((p) => ({
      '@type': 'Offer',
      name: p.name,
      url: `${SITE_URL}/cabanas/${p.slug}`,
      priceCurrency: 'MXN',
      price: p.weekday_price_mxn,
    })),
  }

  return (
    <div className="font-body min-h-full bg-cream">
      {/* Datos estructurados para buscadores e IA (Google, ChatGPT,
          Perplexity, etc.): quién es el negocio, dónde está y qué cabañas
          ofrece, para que puedan citar/recomendar el sitio con datos
          correctos en vez de adivinar. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
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
            <CompactSearchForm
              defaultCheckin={checkin}
              defaultCheckout={checkout}
              defaultGuests={guests}
              defaultJacuzzi={jacuzziOnly}
            />
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
            Cabañas en Huasca de Ocampo
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

      <main id="resultados" className="max-w-5xl mx-auto px-4 pt-16 sm:pt-20 scroll-mt-28">
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
                {results.map(({ property, total, minNightsOk, minNightsRequired }) => {
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
                      href={`/cabanas/${property.slug}?${query.toString()}`}
                      className="group relative block rounded-3xl border border-stone/10 bg-white overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-navy-deep/10"
                    >
                      {coverByProperty.get(property.id) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={optimizedImage(coverByProperty.get(property.id), 640)}
                          loading="lazy"
                          alt={property.name}
                          className="h-52 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="h-52 w-full bg-cream flex items-center justify-center text-stone text-xs">
                          Sin foto
                        </div>
                      )}
                      {property.for_sale && <ForSaleBadge className="top-3 left-3 w-16" />}
                      <div className="p-5">
                        <h3 className="font-display text-xl text-navy-deep">{property.name}</h3>
                        <p className="text-sm text-stone mt-1.5">
                          Hasta {property.capacity} huéspedes · {property.bedrooms} recámaras
                          {property.pet_friendly ? ' · Pet friendly' : ''}
                        </p>
                        <p className="text-sm text-navy-deep mt-4 font-medium">
                          {!minNightsOk ? (
                            <span className="text-gold">
                              Selecciona mínimo {minNightsRequired} noches
                            </span>
                          ) : total != null ? (
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
                        {property.booking_mode === 'whatsapp' && (
                          <p className="text-xs text-[#128C7E] mt-1.5 font-medium">
                            {hasSearch ? 'Disponible en tus fechas · se reserva por WhatsApp' : 'Se reserva por WhatsApp'}
                          </p>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
              {hasSearch && results.length === 0 && (() => {
                // Mensaje amable cuando ya no hay espacio en las fechas buscadas.
                const fmt = (d: string) =>
                  new Date(`${d}T12:00:00Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', timeZone: 'UTC' })
                const phoneDigits = (hostContact?.phone ?? '').replace(/\D/g, '')
                const waHref = phoneDigits
                  ? `https://wa.me/${phoneDigits.length === 10 ? `52${phoneDigits}` : phoneDigits}?text=${encodeURIComponent(
                      `Hola, busqué cabaña del ${fmt(checkin!)} al ${fmt(checkout!)} para ${guestsSummary(guests)} y ya no aparece disponibilidad. ¿Me pueden ayudar con alguna opción?`
                    )}`
                  : null
                return (
                  <div className="rounded-3xl border border-gold/30 bg-white px-6 py-8 sm:px-10 sm:py-10 text-center shadow-sm">
                    <p className="text-4xl" aria-hidden>🌲</p>
                    <h3 className="mt-3 font-display text-2xl text-navy-deep">¡Gracias por pensar en nosotros!</h3>
                    <p className="mt-3 text-stone leading-relaxed max-w-xl mx-auto">
                      Lo sentimos mucho: del <span className="font-medium text-navy-deep">{fmt(checkin!)}</span> al{' '}
                      <span className="font-medium text-navy-deep">{fmt(checkout!)}</span> ya no contamos con espacios
                      disponibles{guests.adults + guests.children > 0 ? ` para ${guestsSummary(guests)}` : ''}. Nos encantaría
                      recibirte en otra ocasión: prueba con otras fechas o escríbenos y con gusto te ayudamos a encontrar la
                      mejor opción.
                      {jacuzziOnly && ' También puedes quitar el filtro de jacuzzi para ver más cabañas.'}
                    </p>
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                      {waHref && (
                        <a
                          href={waHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition"
                        >
                          Escríbenos por WhatsApp
                        </a>
                      )}
                      <a
                        href="#calendario-disponibilidad"
                        className="rounded-full border border-navy-deep/20 px-5 py-2.5 text-sm font-semibold text-navy-deep hover:border-gold transition"
                      >
                        Ver fechas disponibles
                      </a>
                    </div>
                  </div>
                )
              })()}
            </>
          )}
        </div>

        {properties && properties.length > 0 && (
          <div id="calendario-disponibilidad" className="py-12 scroll-mt-28">
            <h2 className="font-display text-2xl sm:text-3xl text-navy-deep mb-5">Calendario de disponibilidad</h2>
            <div className="rounded-3xl border border-stone/10 bg-white p-4 sm:p-6 shadow-sm">
              <PublicAvailabilityGrid
                properties={typedProperties.map((p) => ({
                  id: p.id,
                  slug: p.slug,
                  name: p.name,
                  cover_photo_url: coverByProperty.get(p.id) ?? null,
                  whatsapp: p.booking_mode === 'whatsapp',
                }))}
                windowStart={availabilityStart}
                windowEnd={availabilityEnd}
                blockedDates={availabilityBlocked ?? []}
              />
            </div>
          </div>
        )}

        {saleCount > 0 && (
          <section className="py-6">
            <Link
              href="/en-venta"
              className="group grid overflow-hidden rounded-3xl bg-navy-deep text-cream shadow-sm sm:grid-cols-[1.1fr_1fr]"
            >
              <div className="flex flex-col justify-center gap-3 p-7 sm:p-10">
                <p className="text-xs uppercase tracking-[0.2em] text-gold-light">Casas en venta</p>
                <h2 className="font-display text-2xl sm:text-4xl">¿Buscas comprar casa en Huasca?</h2>
                <p className="text-sm sm:text-base text-cream/80">
                  {saleCount === 1
                    ? 'Tenemos una casa en venta en el Pueblo Mágico. Conoce fotos, precio y todos los detalles.'
                    : `Tenemos ${saleCount} casas en venta en el Pueblo Mágico. Conoce fotos, precios y todos los detalles.`}
                </p>
                <span className="mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-navy-deep group-hover:bg-gold-light transition">
                  Ver casas en venta →
                </span>
              </div>
              {saleCover?.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={optimizedImage(saleCover.url, 828)}
                  alt="Casa en venta en Huasca de Ocampo"
                  loading="lazy"
                  className="h-56 w-full object-cover sm:h-full group-hover:scale-[1.02] transition"
                />
              )}
            </Link>
          </section>
        )}

        {/* Contenido para buscadores (y para quien quiere conocer más antes
            de reservar): texto con las búsquedas principales del nicho,
            links a las páginas por intención y preguntas frecuentes. */}
        <section className="py-12 border-t border-stone/10">
          <h2 className="font-display text-2xl sm:text-3xl text-navy-deep mb-4">
            Hospedaje en Huasca de Ocampo, a 2 horas de la CDMX
          </h2>
          <div className="space-y-4 text-stone leading-relaxed text-justify hyphens-auto">
            <p>
              Huasca Retreats es renta directa de cabañas en Huasca de Ocampo, Hidalgo, el primer Pueblo Mágico de
              México. Nuestras cabañas están en el bosque, con privacidad, fogata y asador; algunas tienen jacuzzi
              privado, chimenea o techo de cristal para dormir viendo las estrellas.
            </p>
            <p>
              Hay opciones para parejas, familias y grupos de hasta 14 personas, y la mayoría son pet friendly. Desde
              aquí visitas los Prismas Basálticos, la Peña del Aire, el Bosque de las Truchas y las haciendas de Santa
              María Regla y San Miguel Regla. Reservas directo con nosotros: ves el precio total al instante y pagas
              en línea, sin comisiones de intermediarios.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {LANDINGS.map((l) => (
              <Link
                key={l.slug}
                href={`/${l.slug}`}
                className="rounded-full border border-stone/20 bg-white px-4 py-2 text-sm text-navy-deep hover:border-gold transition"
              >
                {l.label}
              </Link>
            ))}
          </div>

          <h2 className="font-display text-2xl sm:text-3xl text-navy-deep mt-12 mb-5">Preguntas frecuentes</h2>
          <div className="space-y-3">
            {GENERAL_FAQS.map((f) => (
              <details key={f.q} className="rounded-2xl border border-stone/10 bg-white p-4 sm:p-5 group">
                <summary className="cursor-pointer font-medium text-navy-deep list-none flex justify-between gap-3">
                  {f.q}
                  <span className="text-gold group-open:rotate-45 transition">+</span>
                </summary>
                <p className="mt-3 text-sm text-stone leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
