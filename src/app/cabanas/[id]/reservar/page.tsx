import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { parseGuestsFromParams, guestsSummary } from '@/lib/occupancy'
import { getBookingQuote, type QuoteProperty } from '@/lib/booking-quote'
import ReservarClient from './ReservarClient'

export default async function ReservarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{
    checkin?: string
    checkout?: string
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
      'id, host_id, name, capacity, base_occupancy, max_children, max_infants, infants_count_toward_capacity, pet_friendly, weekday_price_mxn, weekend_price_mxn, extra_guest_fee_mxn, min_nights'
    )
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle()

  if (!property) notFound()

  const { data: allAddons } = await supabase
    .from('addons')
    .select('id, name, description, price_mxn, unit, max_quantity, photo_url')
    .eq('host_id', property.host_id)
    .eq('active', true)
    .order('sort_order', { ascending: true })

  // Si un extra tiene restricciones de unidad guardadas, solo se muestra
  // aquí cuando esta propiedad es una de ellas — sin restricciones, aplica
  // a todas (ver /lib/addons.ts, que aplica el mismo criterio al cobrar).
  const addonIds = (allAddons ?? []).map((a) => a.id)
  const { data: restrictions } =
    addonIds.length > 0
      ? await supabase.from('addon_properties').select('addon_id, property_id').in('addon_id', addonIds)
      : { data: [] }

  const restrictedTo = new Map<string, Set<string>>()
  for (const r of restrictions ?? []) {
    if (!restrictedTo.has(r.addon_id)) restrictedTo.set(r.addon_id, new Set())
    restrictedTo.get(r.addon_id)!.add(r.property_id)
  }

  const addons = (allAddons ?? []).filter((a) => {
    const allowed = restrictedTo.get(a.id)
    return !allowed || allowed.has(id)
  })

  const guests = parseGuestsFromParams(sp)
  const hasSearch = Boolean(checkin && checkout && checkout > checkin)

  const invalid = !hasSearch
    ? 'Faltan las fechas de tu reserva.'
    : null

  const quote = hasSearch
    ? await getBookingQuote(supabase, property as QuoteProperty, checkin!, checkout!, guests)
    : null

  const problem =
    invalid ??
    (quote && !quote.isFree
      ? 'Estas fechas ya no están disponibles.'
      : quote && !quote.fitsGuests
        ? 'El número de huéspedes no cabe en esta cabaña.'
        : quote && !quote.minNightsOk
          ? `Estas fechas requieren mínimo ${quote.minNightsRequired} noches.`
          : null)

  return (
    <div className="font-body min-h-full bg-cream">
      <div className="sticky top-4 z-30 px-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between rounded-[28px] border border-stone/10 bg-white/90 backdrop-blur-md pl-5 pr-2.5 py-2 shadow-[0_1px_3px_rgba(16,27,40,0.08)]">
          <Link href={`/cabanas/${id}`} className="text-xs text-stone hover:text-navy-deep transition">
            ← Volver a {property.name}
          </Link>
          <Link href="/" aria-label="Huasca Retreats" className="shrink-0">
            <Image
              src="/logo.png"
              alt="Huasca Retreats"
              width={800}
              height={750}
              className="h-16 w-auto sm:h-20 drop-shadow-md"
            />
          </Link>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 pt-8 pb-16 sm:pt-10">
        <h1 className="font-display text-2xl sm:text-3xl text-navy-deep">Confirma y paga</h1>
        <p className="text-sm text-stone mt-2">{property.name}</p>

        {problem ? (
          <div className="mt-8 rounded-3xl border border-burnt-orange/25 bg-white p-6 text-center">
            <p className="text-burnt-orange text-sm">{problem}</p>
            <Link
              href={`/cabanas/${id}`}
              className="mt-4 inline-block rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-cream hover:bg-navy-deep transition"
            >
              Elegir otras fechas
            </Link>
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-stone/10 bg-white p-5 sm:p-6 shadow-sm">
            <div className="flex justify-between text-sm text-stone pb-4 border-b border-stone/10">
              <span>
                {checkin} → {checkout} · {quote!.nights.length} {quote!.nights.length === 1 ? 'noche' : 'noches'}
              </span>
              <span>{guestsSummary(guests)}</span>
            </div>

            <ReservarClient
              propertyId={id}
              checkin={checkin!}
              checkout={checkout!}
              guests={guests}
              baseTotal={quote!.total}
              addons={addons ?? []}
              stripePublishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''}
              mercadoPagoPublicKey={process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? ''}
            />
          </div>
        )}

        <p className="text-xs text-stone text-center mt-6">
          Tu método de pago se guarda de forma segura para poder cobrar un depósito por daños después de tu
          estancia, si aplica.
        </p>
      </main>
    </div>
  )
}
