import Link from 'next/link'
import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { parseGuestsFromParams, fitsProperty, guestsSummary } from '@/lib/occupancy'
import { getBookingQuote } from '@/lib/booking-quote'
import { isUuid } from '@/lib/is-uuid'
import GuestPicker from '@/components/GuestPicker'
import CompactSearchForm from '@/components/CompactSearchForm'
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
      'id, host_id, name, slug, description, capacity, bedrooms, beds, bathrooms, pet_friendly, weekday_price_mxn, weekend_price_mxn, base_occupancy, extra_guest_fee_mxn, min_nights, max_nights, cancellation_policy, show_exact_location, google_maps_link, infants_count_toward_capacity, max_infants, max_children, booking_mode, for_sale'
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

  let total: number | null = null
  let nights: string[] = []
  let minNightsRequired = property.min_nights
  let isFree = true
  let minNightsOk = true

  if (hasSearch && !whatsappOnly) {
    const quote = await getBookingQuote(supabase, property, checkin!, checkout!, guests)
    nights = quote.nights
    total = quote.total
    minNightsRequired = quote.minNightsRequired
    minNightsOk = quote.minNightsOk
    isFree = quote.isFree
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
    <div className="font-body min-h-full bg-cream">
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
      <div className="sticky top-4 z-30 px-4">
        <div className="max-w-5xl mx-auto flex flex-col gap-3 rounded-[28px] border border-stone/10 bg-white/90 backdrop-blur-md px-5 py-3 shadow-[0_1px_3px_rgba(16,27,40,0.08)] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-2 sm:pr-2.5">
          <div className="flex items-center justify-between sm:contents">
            <Link href="/" className="sm:order-1 shrink-0 text-xs text-stone hover:text-navy-deep transition">
              ← Volver a la búsqueda
            </Link>
            <Link href="/" aria-label="Huasca Retreats" className="sm:order-3 shrink-0">
              <Image
                src="/logo.png"
                alt="Huasca Retreats"
                width={800}
                height={750}
                className="h-20 w-auto sm:h-24 drop-shadow-md"
              />
            </Link>
          </div>
          <div className="sm:order-2">
            <CompactSearchForm defaultCheckin={checkin} defaultCheckout={checkout} defaultGuests={guests} />
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 pt-8 pb-6 sm:pt-10 sm:pb-8">
        <TrackViewContent id={property.id} name={property.name} price={property.weekday_price_mxn} />
        <PhotoGallery
          photos={photos ?? []}
          alt={`${property.name}, cabaña en Huasca de Ocampo`}
          forSale={Boolean(property.for_sale)}
        />

        <div className="grid lg:grid-cols-[1fr_340px] gap-8 lg:gap-10">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl text-navy-deep">{property.name}</h1>
            <p className="text-sm text-stone mt-2.5">
              Hasta {property.capacity} huéspedes · {property.bedrooms} recámaras · {property.beds} camas ·{' '}
              {property.bathrooms} baños{property.pet_friendly ? ' · Pet friendly' : ''}
            </p>

            {bedsByRoom.size > 0 && (
              <div className="mt-2 text-sm text-stone space-y-0.5">
                {[...bedsByRoom.entries()].map(([room, list]) => (
                  <p key={room}>
                    {room}: {list.join(', ')}
                  </p>
                ))}
              </div>
            )}

            {property.description && (
              <p className="text-[15px] text-navy-deep mt-6 whitespace-pre-line leading-relaxed">
                {property.description}
              </p>
            )}

            {amenityGroups.size > 0 && (
              <div className="mt-8 pt-8 border-t border-stone/10">
                <h2 className="font-display text-xl text-navy-deep mb-4">Amenidades</h2>
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                  {[...amenityGroups.values()].flat().map((label, i) => (
                    <p key={i} className="text-sm text-stone flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-gold shrink-0" />
                      {label}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Todas las cabañas muestran su disponibilidad sincronizada,
                incluidas las que se reservan por WhatsApp. */}
            <div id="disponibilidad" className="mt-8 pt-8 border-t border-stone/10 scroll-mt-40">
              <h2 className="font-display text-xl text-navy-deep mb-4">Disponibilidad</h2>
              {whatsappOnly && (
                <p className="text-sm text-stone -mt-2 mb-4">
                  Elige tus fechas libres en el calendario y te confirmamos por WhatsApp.
                </p>
              )}
              <div className="rounded-3xl border border-stone/10 bg-white p-4 sm:p-6 shadow-sm">
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

            <div className="mt-8 pt-8 border-t border-stone/10 text-sm text-stone space-y-1.5">
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
                  <a href={property.google_maps_link} target="_blank" rel="noopener noreferrer" className="text-gold underline underline-offset-2">
                    Ver ubicación en Google Maps
                  </a>
                </p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-stone/10 bg-white p-5 sm:p-6 h-fit lg:sticky lg:top-20 shadow-sm">
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
              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className="block text-xs font-medium text-stone mb-1">Llegada</span>
                  <input
                    type="date"
                    name="checkin"
                    defaultValue={checkin}
                    min={todayInMexicoStr()}
                    required
                    className="w-full rounded-xl border border-stone/25 px-2.5 py-2 text-sm text-navy-deep focus:outline-none focus:ring-2 focus:ring-gold/50"
                  />
                </label>
                <label>
                  <span className="block text-xs font-medium text-stone mb-1">Salida</span>
                  <input
                    type="date"
                    name="checkout"
                    defaultValue={checkout}
                    min={checkin || todayInMexicoStr()}
                    required
                    className="w-full rounded-xl border border-stone/25 px-2.5 py-2 text-sm text-navy-deep focus:outline-none focus:ring-2 focus:ring-gold/50"
                  />
                </label>
              </div>
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
                    ? 'w-full rounded-full border border-stone/25 px-4 py-2.5 text-sm font-medium text-navy-deep hover:bg-cream transition'
                    : 'w-full rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-navy-deep hover:bg-gold-light transition'
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
                    <TrackedBookLink
                      href={`/cabanas/${property.slug}/reservar?checkin=${checkin}&checkout=${checkout}&adults=${guests.adults}&children=${guests.children}&infants=${guests.infants}&pets=${guests.pets}`}
                      className="mt-4 block text-center w-full rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-navy-deep hover:bg-gold-light transition"
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
                      ? 'block text-center w-full rounded-full bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition'
                      : 'block text-center w-full rounded-full bg-navy px-4 py-2.5 text-sm font-medium text-cream hover:bg-navy-deep transition'
                  }
                >
                  {whatsappOnly ? 'Consultar disponibilidad por WhatsApp' : 'Preguntar / reservar por WhatsApp'}
                </a>
              ) : host?.email ? (
                <a
                  href={`mailto:${host.email}?subject=${encodeURIComponent('Reserva ' + property.name)}&body=${encodeURIComponent(waText)}`}
                  className="block text-center w-full rounded-full bg-navy px-4 py-2.5 text-sm font-medium text-cream hover:bg-navy-deep transition"
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

        <section className="mt-12 pt-8 border-t border-stone/10">
          <h2 className="font-display text-xl text-navy-deep mb-4">Más cabañas en Huasca de Ocampo</h2>
          <div className="flex flex-wrap gap-2">
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
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
