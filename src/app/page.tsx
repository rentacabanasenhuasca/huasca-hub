import Link from 'next/link'
import Image from 'next/image'
import { createServiceClient } from '@/lib/supabase/service'
import { recomputeCalendarRange, nightsBetween, isWeekendNight } from '@/lib/calendar'
import { parseGuestsFromParams, fitsProperty, occupantsFor, guestsSummary } from '@/lib/occupancy'
import CompactSearchForm from '@/components/CompactSearchForm'
import HeroSearchForm from '@/components/HeroSearchForm'
import ScrollHeader from '@/components/ScrollHeader'
import ShareSearchLink from '@/components/ShareSearchLink'
import PublicAvailabilityGrid from '@/components/PublicAvailabilityGrid'
import HeroCarousel from '@/components/HeroCarousel'
import ForSaleBadge from '@/components/ForSaleBadge'
import SiteFooter from '@/components/SiteFooter'
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
  admin_rating: number | null
  price_tier: 'accesible' | 'media' | 'lujo' | null
}

// Tipo de propiedad que el huésped puede filtrar (lo define el anfitrión en
// cada anuncio). En la base el nivel más alto se llama 'lujo'; al huésped se
// le muestra como "Premium".
const TIER_PARAM: Record<string, 'accesible' | 'media' | 'lujo'> = { accesible: 'accesible', media: 'media', premium: 'lujo' }


// Portada (diseño 2026, inspirado en hopfarmbeach.com): foto a pantalla
// completa, titulares tipo póster y secciones amplias. La lógica de búsqueda,
// precios y disponibilidad es la misma de siempre.
const HOME_PATH = '/'

const FOUR_CLS = [
  'pr-4 lg:pr-8',
  'border-l border-[#ddd6c8] pl-4 md:pl-8 lg:pr-8',
  'pr-4 lg:border-l lg:border-[#ddd6c8] lg:pl-8 lg:pr-8',
  'border-l border-[#ddd6c8] pl-4 md:pl-8',
]

// Tiempos aproximados en coche desde las cabañas.
const NEARBY: [string, string][] = [
  ['Centro de Huasca', '10 min'],
  ['Prismas Basálticos', '15 min'],
  ['Peña del Aire', '15 min'],
  ['Hacienda Santa María Regla', '15 min'],
  ['Real del Monte', '30 min'],
  ['Ciudad de México', '2 h'],
]

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
    tipo?: string
  }>
}) {
  const sp = await searchParams
  const { checkin, checkout } = sp
  const guests = parseGuestsFromParams(sp)
  const hasSearch = Boolean(checkin && checkout && checkout > checkin)
  const jacuzziOnly = sp.jacuzzi === '1'
  const tierFilter = sp.tipo ? (TIER_PARAM[sp.tipo] ?? null) : null

  const supabase = createServiceClient()

  const { data: properties } = await supabase
    .from('properties')
    .select(
      'id, host_id, name, slug, capacity, bedrooms, bathrooms, weekday_price_mxn, weekend_price_mxn, base_occupancy, extra_guest_fee_mxn, min_nights, pet_friendly, max_children, max_infants, infants_count_toward_capacity, booking_mode, for_sale, hide_calendar, admin_rating, price_tier'
    )
    .eq('status', 'published')
    .order('name')

  const typedProperties = (properties ?? []) as (PublicProperty & { host_id: string; booking_mode: string | null; for_sale: boolean | null; hide_calendar: boolean | null })[]
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
        // Con el calendario escondido (aún no configurado) no se sabe: se
        // muestra para que pregunten por WhatsApp.
        const taken = blockedByProperty.get(property.id)
        const isFree = property.hide_calendar ? true : !nights.some((d) => taken?.has(d))
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
    .filter((r) => !tierFilter || r.property.price_tier === tierFilter)

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

  // Fotos para las secciones de ambiente (historia, mosaico, cierre): salen
  // de las mismas fotos de las cabañas, así que siempre son reales y se
  // actualizan solas cuando el anfitrión cambia fotos.
  const photosByProperty = new Map<string, string[]>()
  for (const photo of photos ?? []) {
    if (!photosByProperty.has(photo.property_id)) photosByProperty.set(photo.property_id, [])
    photosByProperty.get(photo.property_id)!.push(photo.url)
  }
  const ambient: string[] = []
  for (const p of typedProperties) {
    const list = photosByProperty.get(p.id) ?? []
    if (list[0]) ambient.push(list[0])
  }
  const pick = (i: number) => (ambient.length ? ambient[i % ambient.length] : null)
  const storyPhoto = pick(4)
  const mosaic = [pick(9), pick(2), pick(7), pick(5)]
  const closingPhoto =
    heroMedia?.find((m) => m.media_type === 'image')?.url ?? pick(1)
  const qhSlug = LANDINGS.find((l) => l.slug.startsWith('que-hacer'))?.slug

  const searchProps = {
    defaultCheckin: checkin,
    defaultCheckout: checkout,
    defaultGuests: guests,
    defaultJacuzzi: jacuzziOnly,
    defaultTipo: sp.tipo && TIER_PARAM[sp.tipo] ? sp.tipo : '',
    action: `${HOME_PATH}#resultados`,
  }

  return (
    <div className="font-body min-h-full bg-[#f8f6f1] text-navy-deep">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <ScrollHeader>
        <CompactSearchForm {...searchProps} />
      </ScrollHeader>

      {/* Hero: foto (o video) a todo lo ancho, como hopfarmbeach.com */}
      <section className="relative min-h-[100svh] md:h-[100svh] md:max-h-[940px] md:min-h-[700px] bg-navy-deep text-white">
        <HeroCarousel items={heroMedia ?? []} />

        <header className="relative z-20">
          <div className="flex items-center justify-between gap-6 px-5 py-4 md:px-12 md:py-6">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/logo.png" alt="Huasca Retreats" width={800} height={750} priority className="h-14 w-auto md:h-16" />
              <span className="font-poster hidden text-xl sm:block">Huasca Retreats</span>
            </Link>
            <nav aria-label="Principal" className="hidden items-center gap-7 text-[15px] font-medium lg:flex">
              <a href="#resultados" className="hover:underline underline-offset-8">Cabañas</a>
              <a href="#calendario-disponibilidad" className="hover:underline underline-offset-8">Disponibilidad</a>
              <a href="#cerca" className="hover:underline underline-offset-8">Qué hay cerca</a>
              <Link href="/extras" className="hover:underline underline-offset-8">Extras</Link>
              <a href="#preguntas" className="hover:underline underline-offset-8">Preguntas</a>
              {saleCount > 0 && <Link href="/en-venta" className="hover:underline underline-offset-8">Casas en venta</Link>}
            </nav>
            <a
              href="#buscar"
              className="rounded-md border-[1.5px] border-white/85 px-5 py-2.5 text-[15px] font-semibold transition hover:bg-white hover:text-navy-deep"
            >
              Reservar
            </a>
          </div>
        </header>

        <div className="relative z-10 px-5 pt-[18vh] pb-8 md:absolute md:inset-x-0 md:bottom-[170px] md:px-12 md:pt-0 md:pb-0">
          <h1 className="font-poster max-w-[12ch] text-[clamp(52px,7.6vw,116px)] leading-[0.95] drop-shadow-[0_2px_24px_rgba(0,0,0,0.3)]">
            Despierta en el bosque
          </h1>
          <p className="mt-5 max-w-[30em] text-lg text-white/90 md:text-[19px]">
            Cabañas privadas en Huasca de Ocampo, a dos horas de la Ciudad de México. Busca tus fechas y ve el precio total al instante.
          </p>
        </div>

        {/* Sello que gira, como el de Hop Farm (se detiene con "reducir movimiento") */}
        <div className="pointer-events-none absolute bottom-[200px] right-12 z-10 hidden h-[132px] w-[132px] md:block" aria-hidden="true">
          <svg viewBox="0 0 132 132" className="h-full w-full animate-[spin_40s_linear_infinite] motion-reduce:animate-none">
            <defs>
              <path id="sello" d="M66,66 m-52,0 a52,52 0 1,1 104,0 a52,52 0 1,1 -104,0" />
            </defs>
            <circle cx="66" cy="66" r="64" fill="rgba(20,28,21,0.55)" />
            <text className="font-poster" fontSize="12.5" letterSpacing="3" fill="#fff">
              <textPath href="#sello">Huasca de Ocampo · Hidalgo · Pueblo Mágico · </textPath>
            </text>
          </svg>
          <Image src="/logo.png" alt="" width={800} height={750} className="absolute left-1/2 top-1/2 h-14 w-auto -translate-x-1/2 -translate-y-1/2" />
        </div>

        <div className="relative z-30 px-4 pb-6 md:absolute md:inset-x-12 md:bottom-12 md:px-0 md:pb-0">
          <HeroSearchForm {...searchProps} />
        </div>
      </section>

      {/* Cuatro razones */}
      <section className="mx-auto max-w-[1240px] px-5 py-20 md:px-10 md:py-28">
        <div className="grid grid-cols-2 gap-y-10 lg:grid-cols-4">
          {[
            ['Fogata y jacuzzi', 'Asador y fogata en todas. Varias tienen jacuzzi privado o tina de madera al aire libre.'],
            ['Techo de cristal', 'En las Glasshouse duermes viendo las copas de los pinos y, si está despejado, las estrellas.'],
            ['Trae a tu perro', 'La mayoría son pet friendly, con terreno para que corra sin preocuparte.'],
            ['Hasta 14 personas', 'Hay cabañas para dos y casas completas para la familia o el grupo de amigos.'],
          ].map(([t, d], i) => (
            <div
              key={t}
              className={FOUR_CLS[i]}
            >
              <h3 className="font-poster text-[22px] leading-none md:text-[28px]">{t}</h3>
              <p className="mt-4 text-[15px] leading-relaxed text-[#6f6d5c] md:text-base">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Historia */}
      <section className="mx-auto grid max-w-[1240px] items-center gap-12 px-5 pb-24 md:grid-cols-2 md:gap-20 md:px-10 md:pb-32">
        <div>
          <h2 className="font-poster text-[clamp(40px,5vw,64px)] leading-[0.95]">Hecho para bajar el ritmo</h2>
          <p className="mt-8 max-w-[34em] text-lg leading-[1.75] text-[#6f6d5c] md:text-[19px]">
            Tomas el café en la terraza con la niebla todavía entre los árboles. Por la tarde visitas los Prismas
            Basálticos o la Peña del Aire, y en la noche prendes la fogata y no hay más plan que ese.
          </p>
          <p className="mt-5 max-w-[34em] text-lg leading-[1.75] text-[#6f6d5c] md:text-[19px]">
            Reservas directo con nosotros: sin comisiones de intermediarios, con el precio total desde el principio y
            alguien que te contesta por WhatsApp.
          </p>
        </div>
        {storyPhoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={optimizedImage(storyPhoto, 1080)} alt="" loading="lazy" className="aspect-[4/5] w-full rounded-md object-cover" />
        )}
      </section>

      <main id="resultados" className="mx-auto max-w-[1240px] scroll-mt-24 px-5 pb-24 md:px-10 md:pb-32">
        {!properties || properties.length === 0 ? (
          <p className="text-stone text-sm">Todavía no hay cabañas publicadas.</p>
        ) : (
          <>
            <div className="mb-10 flex flex-col gap-4 md:mb-12 md:flex-row md:items-end md:justify-between">
              <h2 className="font-poster text-[clamp(40px,5vw,64px)] leading-[0.95]">
                {hasSearch ? 'Libres en tus fechas' : 'Nuestras cabañas'}
              </h2>
              {hasSearch ? (
                <p className="text-[#6f6d5c]">
                  {results.length} {results.length === 1 ? 'opción' : 'opciones'} · {nights.length}{' '}
                  {nights.length === 1 ? 'noche' : 'noches'} · {guestsSummary(guests)}
                </p>
              ) : (
                <p className="max-w-[26em] text-[#6f6d5c]">
                  Elige tus fechas arriba y aquí verás cuáles están libres y el total exacto.
                </p>
              )}
            </div>
            {hasSearch && (
              <div className="-mt-4 mb-8">
                <ShareSearchLink />
              </div>
            )}
            <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
              {results.map(({ property, total, minNightsOk, minNightsRequired }) => {
                const query = new URLSearchParams()
                if (checkin) query.set('checkin', checkin)
                if (checkout) query.set('checkout', checkout)
                query.set('adults', String(guests.adults))
                query.set('children', String(guests.children))
                query.set('infants', String(guests.infants))
                query.set('pets', String(guests.pets))

                return (
                  <Link key={property.id} href={`/cabanas/${property.slug}?${query.toString()}`} className="group relative block">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-[#e9e1d2]">
                      {coverByProperty.get(property.id) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={optimizedImage(coverByProperty.get(property.id), 640)}
                          loading="lazy"
                          alt={property.name}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04] motion-reduce:transition-none"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-stone">Sin foto</div>
                      )}
                      {property.for_sale && <ForSaleBadge className="top-3 left-3 w-16" />}
                    </div>
                    <div className="mt-5 flex items-baseline justify-between gap-3">
                      <h3 className="font-poster text-2xl leading-none">{property.name}</h3>
                      {property.admin_rating ? (
                        <span className="shrink-0 text-sm font-semibold" aria-label={`Calificación ${Number(property.admin_rating).toFixed(1)} de 5`}>
                          <span className="text-gold">★</span> {Number(property.admin_rating).toFixed(1)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-[15px] text-[#6f6d5c]">
                      Hasta {property.capacity} huéspedes, {property.bedrooms} recámaras
                      {property.pet_friendly ? ', pet friendly' : ''}
                    </p>
                    <p className="mt-3 font-semibold">
                      {!minNightsOk ? (
                        <span className="text-[#a4512f]">Selecciona mínimo {minNightsRequired} noches</span>
                      ) : total != null ? (
                        <>
                          ${Math.round(total).toLocaleString('es-MX')} MXN{' '}
                          <span className="font-normal text-[#6f6d5c]">
                            en total por {nights.length} {nights.length === 1 ? 'noche' : 'noches'}
                          </span>
                        </>
                      ) : (
                        <>
                          Desde ${Number(property.weekday_price_mxn).toLocaleString('es-MX')} MXN{' '}
                          <span className="font-normal text-[#6f6d5c]">por noche</span>
                        </>
                      )}
                    </p>
                    {property.booking_mode === 'whatsapp' && (
                      <p className="mt-1.5 text-sm font-medium text-[#128C7E]">
                        {hasSearch && !property.hide_calendar
                          ? 'Disponible en tus fechas, se reserva por WhatsApp'
                          : hasSearch
                            ? 'Consulta disponibilidad por WhatsApp'
                            : 'Se reserva por WhatsApp'}
                      </p>
                    )}
                  </Link>
                )
              })}
            </div>
            {hasSearch && results.length === 0 && (() => {
              const fmt = (d: string) =>
                new Date(`${d}T12:00:00Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', timeZone: 'UTC' })
              const phoneDigits = (hostContact?.phone ?? '').replace(/\D/g, '')
              const waHref = phoneDigits
                ? `https://wa.me/${phoneDigits.length === 10 ? `52${phoneDigits}` : phoneDigits}?text=${encodeURIComponent(
                    `Hola, busqué cabaña del ${fmt(checkin!)} al ${fmt(checkout!)} para ${guestsSummary(guests)} y ya no aparece disponibilidad. ¿Me pueden ayudar con alguna opción?`
                  )}`
                : null
              return (
                <div className="rounded-lg bg-[#e9e1d2] px-6 py-10 text-center sm:px-10">
                  <h3 className="font-poster text-3xl">Esas fechas ya están llenas</h3>
                  <p className="mx-auto mt-4 max-w-xl leading-relaxed text-[#6f6d5c]">
                    Del <span className="font-semibold text-navy-deep">{fmt(checkin!)}</span> al{' '}
                    <span className="font-semibold text-navy-deep">{fmt(checkout!)}</span> ya no hay espacio
                    {guests.adults + guests.children > 0 ? ` para ${guestsSummary(guests)}` : ''}. Prueba con otras
                    fechas o escríbenos y te ayudamos a encontrar opción.
                    {jacuzziOnly && ' También puedes quitar el filtro de jacuzzi para ver más cabañas.'}
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    {waHref && (
                      <a href={waHref} target="_blank" rel="noopener noreferrer" className="rounded-md bg-[#25D366] px-5 py-3 text-sm font-semibold text-white hover:opacity-90">
                        Escríbenos por WhatsApp
                      </a>
                    )}
                    <a href="#calendario-disponibilidad" className="rounded-md border-[1.5px] border-navy-deep px-5 py-3 text-sm font-semibold hover:bg-navy-deep hover:text-cream">
                      Ver fechas libres
                    </a>
                  </div>
                </div>
              )
            })()}
          </>
        )}
      </main>

      {/* Un día en Huasca + mosaico de fotos a todo lo ancho */}
      {mosaic.every(Boolean) && (
        <section aria-labelledby="dia">
          <div className="bg-navy-deep px-5 py-24 text-center md:py-28">
            <h2 id="dia" className="font-poster text-[clamp(44px,5.5vw,72px)] leading-[0.95] text-gold">Un día en Huasca</h2>
            <p className="mt-5 text-lg text-[#e9e1d2]/85 md:text-[19px]">Niebla en la mañana, fogata en la noche.</p>
          </div>
          <div className="grid bg-navy-deep md:grid-cols-2">
            <div className="grid min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={optimizedImage(mosaic[0]!, 1080)} alt="" loading="lazy" className="aspect-square w-full object-cover" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={optimizedImage(mosaic[1]!, 1080)} alt="" loading="lazy" className="hidden aspect-[1/0.62] w-full object-cover md:block" />
            </div>
            <div className="grid min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={optimizedImage(mosaic[2]!, 1080)} alt="" loading="lazy" className="aspect-[1/0.62] w-full object-cover" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={optimizedImage(mosaic[3]!, 1080)} alt="" loading="lazy" className="hidden aspect-square w-full object-cover md:block" />
            </div>
          </div>
        </section>
      )}

      {properties && properties.length > 0 && (
        <section id="calendario-disponibilidad" className="mx-auto max-w-[1240px] scroll-mt-24 px-5 py-24 md:px-10 md:py-32">
          <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <h2 className="font-poster text-[clamp(40px,5vw,64px)] leading-[0.95]">Fechas libres</h2>
            <p className="max-w-[26em] text-[#6f6d5c]">Lo oscuro ya está reservado. Toca una cabaña para ver su calendario completo.</p>
          </div>
          <div className="rounded-lg border border-[#e6e0d3] bg-white p-4 sm:p-6">
            <PublicAvailabilityGrid
              properties={typedProperties.filter((p) => !p.hide_calendar).map((p) => ({
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
        </section>
      )}

      {/* Qué hay cerca */}
      <section id="cerca" className="scroll-mt-24 bg-[#e9e1d2] py-24 md:py-28">
        <div className="mx-auto grid max-w-[1240px] gap-12 px-5 md:grid-cols-[1fr_1.1fr] md:gap-20 md:px-10">
          <div>
            <h2 className="font-poster text-[clamp(40px,5vw,64px)] leading-[0.95]">Qué hay cerca</h2>
            <p className="mt-7 max-w-[28em] text-lg text-[#6f6d5c] md:text-[19px]">
              Huasca fue el primer Pueblo Mágico de México. Todo esto te queda en coche desde la cabaña.
            </p>
            {qhSlug && (
              <Link href={`/${qhSlug}`} className="mt-8 inline-block rounded-md border-[1.5px] border-navy-deep px-6 py-3 font-semibold hover:bg-navy-deep hover:text-cream">
                Qué hacer en Huasca
              </Link>
            )}
          </div>
          <ul>
            {NEARBY.map(([place, time]) => (
              <li key={place} className="flex justify-between gap-5 border-b border-[#cfc5b0] py-[18px] text-lg">
                <span>{place}</span>
                <span className="whitespace-nowrap font-semibold">{time}</span>
              </li>
            ))}
            <li className="pt-4 text-sm text-[#6f6d5c]">Tiempos aproximados en coche.</li>
          </ul>
        </div>
      </section>

      {saleCount > 0 && (
        <section className="mx-auto max-w-[1240px] px-5 pt-24 md:px-10 md:pt-32">
          <Link href="/en-venta" className="group grid overflow-hidden rounded-lg bg-navy-deep text-[#f8f6f1] md:grid-cols-[1fr_1.1fr]">
            <div className="flex flex-col justify-center p-8 md:p-14">
              <h2 className="font-poster text-[clamp(34px,3.6vw,46px)] leading-[0.95]">¿Buscas comprar casa en Huasca?</h2>
              <p className="mt-5 max-w-[26em] text-[#f8f6f1]/80">
                {saleCount === 1
                  ? 'Tenemos una casa en venta en el Pueblo Mágico. Conoce fotos, precio y todos los detalles.'
                  : `Tenemos ${saleCount} casas en venta en el Pueblo Mágico. Conoce fotos, precios y todos los detalles.`}
              </p>
              <span className="mt-7 inline-block w-fit rounded-md bg-gold px-6 py-3 font-semibold text-navy-deep group-hover:bg-gold-light">
                Ver casas en venta
              </span>
            </div>
            {saleCover?.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={optimizedImage(saleCover.url, 1080)} alt="Casa en venta en Huasca de Ocampo" loading="lazy" className="h-64 w-full object-cover md:h-full md:min-h-[360px]" />
            )}
          </Link>
        </section>
      )}

      {/* Texto para buscadores + preguntas frecuentes */}
      <section id="preguntas" className="mx-auto grid max-w-[1240px] scroll-mt-24 gap-12 px-5 py-24 md:grid-cols-[1fr_1.4fr] md:gap-20 md:px-10 md:py-32">
        <div>
          <h2 className="font-poster text-[clamp(40px,5vw,64px)] leading-[0.95]">Antes de reservar</h2>
          <h3 className="mt-8 text-lg font-semibold">Hospedaje en Huasca de Ocampo, a 2 horas de la CDMX</h3>
          <p className="mt-3 max-w-[30em] leading-relaxed text-[#6f6d5c]">
            Huasca Retreats es renta directa de cabañas en Huasca de Ocampo, Hidalgo, el primer Pueblo Mágico de
            México. Nuestras cabañas están en el bosque, con privacidad, fogata y asador; algunas tienen jacuzzi
            privado, chimenea o techo de cristal para dormir viendo las estrellas.
          </p>
          <p className="mt-3 max-w-[30em] leading-relaxed text-[#6f6d5c]">
            Hay opciones para parejas, familias y grupos de hasta 14 personas, y la mayoría son pet friendly. Desde
            aquí visitas los Prismas Basálticos, la Peña del Aire, el Bosque de las Truchas y las haciendas de Santa
            María Regla y San Miguel Regla. Reservas directo con nosotros: ves el precio total al instante y pagas en
            línea, sin comisiones de intermediarios.
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            {LANDINGS.map((l) => (
              <Link key={l.slug} href={`/${l.slug}`} className="rounded-full border border-[#d6cdbb] px-4 py-2 text-sm font-medium hover:border-navy-deep">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="border-t border-[#ddd6c8]">
          {GENERAL_FAQS.map((f) => (
            <details key={f.q} className="group border-b border-[#ddd6c8] py-6">
              <summary className="flex cursor-pointer list-none justify-between gap-5 text-lg font-semibold">
                {f.q}
                <span className="text-2xl leading-none text-[#a4512f] transition group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="mt-3 max-w-[40em] leading-relaxed text-[#6f6d5c]">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Cierre */}
      <section className="relative overflow-hidden bg-navy-deep text-white">
        {closingPhoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={optimizedImage(closingPhoto, 1920)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-[rgba(12,18,13,0.45)]" />
        <div className="relative flex min-h-[520px] flex-col items-center justify-center gap-6 px-6 py-24 text-center md:min-h-[620px]">
          <h2 className="font-poster text-[clamp(52px,8vw,120px)] leading-[0.95]">Quédate unos días</h2>
          <p className="text-lg text-white/90 md:text-[19px]">Elige tus fechas y ve el total al instante.</p>
          <a href="#buscar" className="rounded-md bg-gold px-8 py-4 text-[17px] font-semibold text-navy-deep hover:bg-gold-light">
            Buscar fechas
          </a>
        </div>
      </section>

      <SiteFooter className="" />
    </div>
  )
}
