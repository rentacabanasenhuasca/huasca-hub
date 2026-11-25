import Link from 'next/link'
import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { parseGuestsFromParams, fitsProperty, guestsSummary } from '@/lib/occupancy'
import { getBookingQuote } from '@/lib/booking-quote'
import { isUuid } from '@/lib/is-uuid'
import GuestPicker from '@/components/GuestPicker'
import DateRangePicker from '@/components/DateRangePicker'
import PhotoGallery from '@/components/PhotoGallery'
import SiteFooter from '@/components/SiteFooter'
import TrackViewContent from '@/components/TrackViewContent'
import TrackedBookLink from '@/components/TrackedBookLink'
import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/site'
import { todayInMexicoStr } from '@/lib/dates'
import { Suspense } from 'react'
import CabinAvailabilityCalendar from '@/components/CabinAvailabilityCalendar'
import { LANDINGS } from '@/lib/seo-landings'

// Rasgo principal de la cabaña para el <title> y la descripción (lo que más
// se busca: jacuzzi, techo de cristal, chimenea).
function seoFeatures(name: string, description: string | null, amenities: string[]) {
  const has = (l: string) => amenities.some((a) => a.toLowerCase() === l.toLowerCase())
  const out: string[] = []
  if (has('Jacuzzi')) out.push('jacuzzi privado')
  if (/glasshouse/i.test(name) || /techo de cristal/i.test(description ?? '')) out.push('techo de cristal')
  if (has('Chimenea interior')) out.push('chimenea')
  if (has('Fogata / fogatero')) out.push('fogata')
  return out
}

function waLink(phone: string, text: string) {
  const digits = phone.replace(/[^\d]/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

const ROOM_TYPE_LABELS: Record<string, string> = {
  recamara: 'Recámara',
  altillo_tapanco: 'Altillo / Tapanco', otro: 'Otro espacio',
}

const BED_TYPE_LABELS: Record<string, { singular: string; plural: string }> = {
  individual: { singular: 'individual', plural: 'individuales' },
  matrimonial: { singular: 'matrimonial', plural: 'matrimoniales' },
  queen: { singular: 'queen', plural: 'queen' },
  king: { singular: 'king', plural: 'king' },
  litera: { singular: 'litera', plural: 'literas' },
  cuna: { singular: 'cuna', plural: 'cunas' }, sofa_cama: { singular: 'sofá cama', plural: 'sofás cama' },
}

function bedLabel(bedType: string, quantity: number) {
  const labels = BED_TYPE_LABELS[bedType]
  const size = quantity === 1 ? (labels?.singular ?? bedType) : (labels?.plural ?? bedType)
  return `${quantity} cama${quantity === 1 ? '' : 's'} ${size}`
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: property } = await supabase
    .from('properties')
    .select('id, name, slug, description, capacity, bedrooms, bathrooms, weekday_price_mxn, pet_friendly')
    .eq(isUuid(id) ? 'id' : 'slug', id)
    .eq('status', 'published')
    .maybeSingle()

  if (!property) return {}

  const { data: cover } = await supabase
    .from('property_photos')
    .select('url')
    .eq('property_id', property.id)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()

  const { data: amenityRows } = await supabase
    .from('property_amenities')
    .select('amenities(label)')
    .eq('property_id', property.id)
  const amenityLabels = ((amenityRows ?? []) as unknown as { amenities: { label: string } | { label: string }[] | null }[])
    .map((r) => (Array.isArray(r.amenities) ? r.amenities[0]?.label : r.amenities?.label))
    .filter((l): l is string => Boolean(l))
  const features = seoFeatures(property.name, property.description, amenityLabels)

  const title = features.length
    ? `${property.name}: cabaña con ${features[0]} en Huasca de Ocampo`
    : `${property.name}: cabaña en Huasca de Ocampo para ${property.capacity} personas`
  const featureText = features.length ? `, con ${features.join(', ')}` : ''
  const description = `${property.name}, cabaña en el bosque de Huasca de Ocampo, Hidalgo, para hasta ${property.capacity} huéspedes${featureText}${property.pet_friendly ? '. Pet friendly' : ''}. Desde $${Number(property.weekday_price_mxn).toLocaleString('es-MX')} MXN por noche. Reserva directo y sin comisiones.`

  return {
    title,
    description,
    alternates: { canonical: `/cabanas/${property.slug}` },
    openGraph: {
      title,
      description,
      url: `/cabanas/${property.slug}`,
      images: cover?.url ? [{ url: cover.url }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: cover?.url ? [cover.url] : undefined,
    },
  }
}

export default async function CabanaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
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
  const { id } = await params
  const sp = await searchParams
  const { checkin, checkout } = sp
  const supabase = createServiceClient()

  const { data: property } = await supabase
    .from('properties')
    .select(
      'id, host_id, name, slug, description, capacity, bedrooms, beds, bathrooms, pet_friendly, weekday_price_mxn, weekend_price_mxn, base_occupancy, extra_guest_fee_mxn, min_nights, max_nights, cancellation_policy, show_exact_location, google_maps_link, infants_count_toward_capacity, max_infants, max_children, booking_mode, for_sale, hide_calendar, admin_rating'
    )
    .eq(isUuid(id) ? 'id' : 'slug', id)
    .eq('status', 'published')
    .maybeSingle()

  if (!property) notFound()

  // URLs viejas compartidas con el UUID crudo siguen funcionando (arriba),
  // pero si alguien llega así lo mandamos a la URL bonita con el slug para
  // que eso sea lo que quede indexado y se comparta de aquí en adelante.
  if (property.slug !== id) redirect(`/cabanas/${property.slug}`)

  const [{ data: photos }, { data: propertyAmenities }, { data: propertyBeds }, { data: host }] = await Promise.all([
    supabase
      .from('property_photos')
      .select('url, category, description, sort_order')
      .eq('property_id', property.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('property_amenities')
      .select('description, amenities(label, category)')
      .eq('property_id', property.id),
    supabase
      .from('property_beds')
      .select('room_type, room_number, bed_type, quantity')
      .eq('property_id', property.id)
      .order('sort_order', { ascending: true }),
    supabase.from('hosts').select('name, phone, email').eq('id', property.host_id).maybeSingle(),
  ])

  // Camas agrupadas por espacio: "Recámara 1: 1 cama king, 1 cama individual".
  // Si solo hay una recámara se muestra como "Recámara" a secas.
  const bedRows = (propertyBeds ?? []) as { room_type: string; room_number: number | null; bed_type: string; quantity: number }[]
  const roomNumbers = new Set(bedRows.filter((b) => b.room_type === 'recamara').map((b) => b.room_number ?? 0))
  const bedsByRoom = new Map<string, string[]>()
  for (const b of bedRows) {
    const key =
      b.room_type === 'recamara' && b.room_number && roomNumbers.size > 1
        ? `Recámara ${b.room_number}`
        : (ROOM_TYPE_LABELS[b.room_type] ?? b.room_type)
    const list = bedsByRoom.get(key) ?? []
    list.push(bedLabel(b.bed_type, b.quantity))
    bedsByRoom.set(key, list)
  }

  const guests = parseGuestsFromParams(sp)
  if (!sp.adults && !sp.guests) guests.adults = property.base_occupancy || guests.adults
  const hasSearch = Boolean(checkin && checkout && checkout > checkin)
  // "Solo por WhatsApp": se anuncia pero no se cotiza ni se paga en línea;
  // el huésped pregunta disponibilidad por WhatsApp.
  const whatsappOnly = property.booking_mode === 'whatsapp'
  // Calendario escondido (p. ej. aún no configurado): no se muestra la
  // disponibilidad ni se tachan días en el selector de fechas.
  const hideCalendar = Boolean((property as { hide_calendar?: boolean | null }).hide_calendar)

  let total: number | null = null
  let nights: string[] = []
  let minNightsRequired = property.min_nights
  let isFree = true
  let minNightsOk = true
  let minGuestsCharged: number | null = null

  if (hasSearch && !whatsappOnly) {
    const quote = await getBookingQuote(supabase, property, checkin!, checkout!, guests)
    nights = quote.nights
    total = quote.total
    minNightsRequired = quote.minNightsRequired
    minNightsOk = quote.minNightsOk
    isFree = quote.isFree
    minGuestsCharged = quote.minGuestsCharged
  }

  const fitsGuests = fitsProperty(property, guests)

  // Noches ocupadas de los próximos 12 meses, para el calendario de la cabaña.
  const availabilityStart = todayInMexicoStr()
  const availabilityEnd = (() => {
    const d = new Date(`${availabilityStart}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + 365)
    return d.toISOString().slice(0, 10)
  })()
  const { data: availabilityBlocked } = await supabase
    .from('blocked_dates')
    .select('date')
    .eq('property_id', property.id)
    .gte('date', availabilityStart)
    .lte('date', availabilityEnd)

  const amenityGroups = new Map<string, string[]>()
  for (const pa of (propertyAmenities ?? []) as unknown as {
    description: string | null
    amenities: { label: string; category: string } | null
  }[]) {
    if (!pa.amenities) continue
    const list = amenityGroups.get(pa.amenities.category) ?? []
    list.push(pa.description ? `${pa.amenities.label} (${pa.description})` : pa.amenities.label)
    amenityGroups.set(pa.amenities.category, list)
  }

  const waText = whatsappOnly
    ? `Hola, quiero saber si ${property.name} está disponible${
        hasSearch ? ` del ${checkin} al ${checkout} para ${guestsSummary(guests)}` : ''
      }.`
    : `Hola, me interesa reservar ${property.name}${
        hasSearch ? ` del ${checkin} al ${checkout} para ${guestsSummary(guests)}` : ''
      }.`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: property.name,
    description: property.description || undefined,
    url: `${SITE_URL}/cabanas/${property.slug}`,
    image: (photos ?? []).map((p) => p.url),
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Huasca de Ocampo',
      addressRegion: 'Hidalgo',
      addressCountry: 'MX',
    },
    petsAllowed: property.pet_friendly,
    numberOfRooms: property.bedrooms,
    amenityFeature: [...amenityGroups.values()].flat().slice(0, 40).map((label) => ({
      '@type': 'LocationFeatureSpecification',
      name: label,
      value: true,
    })),
    occupancy: { '@type': 'QuantitativeValue', maxValue: property.capacity },
    priceRange: `$${property.weekday_price_mxn} - $${property.weekend_price_mxn} MXN`,
  }

  return (
    <div className="font-body min-h-full bg-[#f8f6f1] text-navy-deep">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Cabañas en Huasca de Ocampo', item: SITE_URL },
              { '@type': 'ListItem', position: 2, name: property.name, item: `${SITE_URL}/cabanas/${property.slug}` },
            ],
          }),
        }}
      />
      <header className="sticky top-0 z-30 border-b border-stone/15 bg-[#f8f6f1]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-5 py-2 md:px-10">
          <Link href="/" className="flex items-center gap-3" aria-label="Huasca Retreats">
            <Image src="/logo.png" alt="Huasca Retreats" width={800} height={750} className="h-12 w-auto md:h-14" />
            <span className="font-poster hidden text-lg sm:block">Huasca Retreats</span>
          </Link>
          <nav aria-label="Principal" className="flex items-center gap-5 text-[15px] font-medium">
            <Link href="/#resultados" className="hidden hover:underline underline-offset-8 sm:inline">Todas las cabañas</Link>
            <a href="#reservar" className="rounded-md border-[1.5px] border-navy-deep px-4 py-2 font-semibold transition hover:bg-navy-deep hover:text-cream">
              Reservar
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-5 pt-8 pb-16 md:px-10 md:pt-10 md:pb-24">
        <TrackViewContent id={property.id} name={property.name} price={property.weekday_price_mxn} />
        <PhotoGallery
          photos={photos ?? []}
          alt={`${property.name}, cabaña en Huasca de Ocampo`}
          forSale={Boolean(property.for_sale)}
        />

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16">
          <div>
            <h1 className="font-poster text-[clamp(40px,5vw,64px)] leading-[0.95]">{property.name}</h1>
            {property.admin_rating ? (
              <p className="mt-3 text-[15px] font-semibold">
                <span className="text-gold">★</span> {Number(property.admin_rating).toFixed(1)}{' '}
                <span className="font-normal text-[#6f6d5c]">calificación Huasca Retreats</span>
              </p>
            ) : null}
            <p className="mt-4 text-lg text-[#6f6d5c]">
              Hasta {property.capacity} huéspedes, {property.bedrooms} recámaras, {property.beds} camas y{' '}
              {property.bathrooms} baños{property.pet_friendly ? '. Pet friendly' : ''}
            </p>

            {bedsByRoom.size > 0 && (
              <div className="mt-3 space-y-0.5 text-[15px] text-[#6f6d5c]">
                {[...bedsByRoom.entries()].map(([room, list]) => (
                  <p key={room}>
                    {room}: {list.join(', ')}
                  </p>
                ))}
              </div>
            )}

            {property.description && (
              <p className="mt-8 max-w-[38em] whitespace-pre-line text-lg leading-[1.75] text-[#4f4d40]">
                {property.description}
              </p>
            )}

            {amenityGroups.size > 0 && (
              <div className="mt-14">
                <h2 className="font-poster mb-6 text-[clamp(30px,3.4vw,40px)] leading-none">Qué hay aquí</h2>
                <ul className="grid gap-x-10 sm:grid-cols-2">
                  {[...amenityGroups.values()].flat().map((label, i) => (
                    <li key={i} className="border-b border-[#ddd6c8] py-3 text-[15px]">
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Todas las cabañas muestran su disponibilidad sincronizada,
                incluidas las que se reservan por WhatsApp. */}
            {!hideCalendar && (
            <div id="disponibilidad" className="mt-14 scroll-mt-24">
              <h2 className="font-poster mb-6 text-[clamp(30px,3.4vw,40px)] leading-none">Fechas libres</h2>
              {whatsappOnly && (
                <p className="-mt-2 mb-4 text-[15px] text-[#6f6d5c]">
                  Elige tus fechas libres en el calendario y te confirmamos por WhatsApp.
                </p>
              )}
              <div className="rounded-lg border border-[#e6e0d3] bg-white p-4 sm:p-6">
                <Suspense fallback={null}>
                  <CabinAvailabilityCalendar
                    blockedDates={(availabilityBlocked ?? []).map((b) => b.date)}
                    today={availabilityStart}
                    windowEnd={availabilityEnd}
                    checkin={hasSearch ? checkin : undefined}
                    checkout={hasSearch ? checkout : undefined}
                  />
                </Suspense>
              </div>
            </div>
            )}

            <div className="mt-14 space-y-1.5 border-t border-[#ddd6c8] pt-8 text-[15px] text-[#6f6d5c]">
              <p>Estancia mínima: {property.min_nights} noche(s){property.max_nights ? ` · máxima ${property.max_nights}` : ''}</p>
              <p>
                Política de cancelación:{' '}
                {property.cancellation_policy === 'flexible'
                  ? 'flexible'
                  : property.cancellation_policy === 'estricta'
                    ? 'estricta'
                    : 'moderada'}
              </p>
              {property.max_children != null && <p>Máximo {property.max_children} niños (desde 3 años, cuentan como huésped).</p>}
              {property.google_maps_link && property.show_exact_location && (
                <p>
                  <a href={property.google_maps_link} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy-deep underline underline-offset-4">
                    Ver ubicación en Google Maps
                  </a>
                </p>
              )}
            </div>
          </div>

          <div id="reservar" className="h-fit scroll-mt-24 rounded-lg border border-[#e6e0d3] bg-white p-5 sm:p-7 lg:sticky lg:top-24">
            {whatsappOnly && (
              <div className="mb-4">
                <p className="text-navy-deep">
                  <span className="text-sm text-stone">Desde </span>
                  <span className="text-xl font-semibold">${Math.round(Number(property.weekday_price_mxn)).toLocaleString('es-MX')}</span>
                  <span className="text-sm text-stone"> MXN por noche</span>
                </p>
                <p className="text-xs text-stone mt-1">Esta cabaña se reserva directo por WhatsApp: pon tus fechas y pregúntanos por disponibilidad.</p>
              </div>
            )}
            <form method="get" className="space-y-3">
              <DateRangePicker
                defaultCheckin={checkin}
                defaultCheckout={checkout}
                blockedDates={hideCalendar ? [] : (availabilityBlocked ?? []).map((b) => b.date)}
              />
              <label className="block">
                <span className="block text-xs font-medium text-stone mb-1">Huéspedes</span>
                <GuestPicker defaultGuests={guests} />
              </label>
              {/* Si ya hay una búsqueda con resultado, el total y el botón de
                  "Reservar y pagar" de abajo ya son el CTA principal — este
                  botón queda solo para volver a calcular si cambian fechas o
                  huéspedes, así que se ve secundario en vez de duplicar el
                  mismo llamado a la acción. */}
              <button
                type="submit"
                className={
                  hasSearch
                    ? 'w-full rounded-md border-[1.5px] border-navy-deep px-4 py-3 text-sm font-semibold text-navy-deep hover:bg-navy-deep hover:text-cream transition'
                    : 'w-full rounded-md bg-gold px-4 py-3 text-base font-semibold text-navy-deep hover:bg-gold-light transition'
                }
              >
                {hasSearch ? 'Actualizar fechas' : whatsappOnly ? 'Agregar fechas al mensaje' : 'Ver precio'}
              </button>
            </form>

            {hasSearch && !whatsappOnly && (
              <div className="mt-5 pt-5 border-t border-stone/10 text-sm">
                {!isFree ? (
                  <p className="text-burnt-orange">
                    Esta cabaña ya no está disponible para esas fechas.
                  </p>
                ) : !fitsGuests ? (
                  <p className="text-burnt-orange">
                    Esta cabaña admite hasta {property.capacity} huéspedes.
                  </p>
                ) : !minNightsOk ? (
                  <p className="text-burnt-orange">
                    Estas fechas requieren mínimo {minNightsRequired} noches.
                  </p>
                ) : (
                  <>
                    <div className="flex justify-between text-stone">
                      <span>
                        {nights.length} {nights.length === 1 ? 'noche' : 'noches'} · {guestsSummary(guests)}
                      </span>
                    </div>
                    <div className="flex justify-between text-navy-deep font-semibold text-lg mt-1.5">
                      <span>Total</span>
                      <span>${Math.round(total ?? 0).toLocaleString('es-MX')} MXN</span>
                    </div>
                    {minGuestsCharged && (
                      <p className="mt-1 text-xs text-stone">
                        En estas fechas la tarifa mínima es para {minGuestsCharged} personas; el total ya lo incluye.
                      </p>
                    )}
                    <TrackedBookLink
                      href={`/cabanas/${property.slug}/reservar?checkin=${checkin}&checkout=${checkout}&adults=${guests.adults}&children=${guests.children}&infants=${guests.infants}&pets=${guests.pets}`}
                      className="mt-4 block w-full rounded-md bg-gold px-4 py-3 text-center text-base font-semibold text-navy-deep transition hover:bg-gold-light"
                      propertyId={property.id}
                      value={total ?? 0}
                    >
                      Reservar y pagar
                    </TrackedBookLink>
                  </>
                )}
              </div>
            )}

            <div className="mt-5 pt-5 border-t border-stone/10">
              {host?.phone ? (
                <a
                  href={waLink(host.phone, waText)}
                  target="_blank" rel="noopener noreferrer"
                  className={
                    whatsappOnly
                      ? 'block text-center w-full rounded-md bg-[#25D366] px-4 py-3 text-sm font-semibold text-white hover:opacity-90 transition'
                      : 'block text-center w-full rounded-md bg-navy-deep px-4 py-3 text-sm font-semibold text-cream hover:bg-navy transition'
                  }
                >
                  {whatsappOnly ? 'Consultar disponibilidad por WhatsApp' : 'Preguntar / reservar por WhatsApp'}
                </a>
              ) : host?.email ? (
                <a
                  href={`mailto:${host.email}?subject=${encodeURIComponent('Reserva ' + property.name)}&body=${encodeURIComponent(waText)}`}
                  className="block w-full rounded-md bg-navy-deep px-4 py-3 text-center text-sm font-semibold text-cream transition hover:bg-navy"
                >
                  Preguntar / reservar por correo
                </a>
              ) : null}
              {!whatsappOnly && (
                <p className="text-xs text-stone text-center mt-2.5">
                  Por ahora las reservas se confirman directo contigo. El pago en línea llega pronto.
                </p>
              )}
            </div>
          </div>
        </div>

        <section className="mt-20">
          <h2 className="font-poster mb-6 text-[clamp(30px,3.4vw,40px)] leading-none">Más cabañas en Huasca</h2>
          <div className="flex flex-wrap gap-2">
            {LANDINGS.map((l) => (
              <Link
                key={l.slug}
                href={`/${l.slug}`}
                className="rounded-full border border-[#d6cdbb] px-4 py-2 text-sm font-medium transition hover:border-navy-deep"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter className="" />
    </div>
  )
}
