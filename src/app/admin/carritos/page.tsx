import { requireHost } from '@/lib/hosts'
import { createServiceClient } from '@/lib/supabase/service'
import { cartResumeUrl, cartWhatsAppLink, cartWhatsAppMessage, shortDate, ABANDON_AFTER_MINUTES, type CartRow } from '@/lib/carts'
import { todayInMexicoStr } from '@/lib/dates'
import CartsManager, { type CartView } from './CartsManager'

export const dynamic = 'force-dynamic'

function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 24 * 3600_000).toISOString()
}

export default async function CarritosPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const host = await requireHost()
  const { ver } = await searchParams
  const showAll = ver === 'todos'
  const supabase = createServiceClient()

  const since = daysAgoIso(60)
  let query = supabase
    .from('checkout_carts')
    .select('*')
    .eq('host_id', host.id)
    .gte('created_at', since)
    .order('updated_at', { ascending: false })
    .limit(200)
  if (!showAll) query = query.neq('stage', 'reservado').in('status', ['abierto', 'contactado'])
  const { data: cartsRaw } = await query
  const carts = (cartsRaw ?? []) as CartRow[]

  const propertyIds = [...new Set(carts.map((c) => c.property_id))]
  const minDate = carts.reduce((m, c) => (c.check_in < m ? c.check_in : m), '9999-12-31')
  const maxDate = carts.reduce((m, c) => (c.check_out > m ? c.check_out : m), '0000-01-01')

  const [{ data: properties }, { data: blocked }, { data: hostRow }] = await Promise.all([
    propertyIds.length
      ? supabase.from('properties').select('id, name, slug').in('id', propertyIds)
      : Promise.resolve({ data: [] as { id: string; name: string; slug: string }[] }),
    propertyIds.length
      ? supabase
          .from('blocked_dates')
          .select('property_id, date')
          .in('property_id', propertyIds)
          .gte('date', minDate)
          .lt('date', maxDate)
      : Promise.resolve({ data: [] as { property_id: string; date: string }[] }),
    supabase.from('hosts').select('cart_auto_email').eq('id', host.id).maybeSingle(),
  ])

  const propertyById = new Map((properties ?? []).map((p) => [p.id, p]))
  const blockedSet = new Set((blocked ?? []).map((b) => `${b.property_id}|${b.date}`))
  const today = todayInMexicoStr()

  const views: CartView[] = carts.flatMap((c) => {
    const property = propertyById.get(c.property_id)
    if (!property) return []
    let free = true
    for (let d = c.check_in; d < c.check_out; ) {
      if (blockedSet.has(`${c.property_id}|${d}`)) {
        free = false
        break
      }
      const x = new Date(`${d}T00:00:00Z`)
      x.setUTCDate(x.getUTCDate() + 1)
      d = x.toISOString().slice(0, 10)
    }
    const guestsText = `${c.adults} adultos${c.children ? `, ${c.children} niños` : ''}${c.infants ? `, ${c.infants} bebés` : ''}${c.pets ? `, ${c.pets} mascota(s)` : ''}`
    const resumeUrl = cartResumeUrl(c, property.slug)
    const total = `$${Math.round(Number(c.quoted_total_mxn ?? 0)).toLocaleString('es-MX')} MXN`
    const copyText = [
      `Nombre: ${c.guest_name ?? ''}`,
      `Teléfono: ${c.guest_phone ?? ''}`,
      `Correo: ${c.guest_email ?? ''}`,
      `Cabaña: ${property.name}`,
      `Fechas: ${c.check_in} a ${c.check_out}`,
      `Huéspedes: ${guestsText}`,
      `Total cotizado: ${total}`,
      c.discount_code ? `Cupón: ${c.discount_code}` : null,
      c.guest_notes ? `Notas: ${c.guest_notes}` : null,
      `Liga para retomar: ${resumeUrl}`,
    ]
      .filter(Boolean)
      .join('\n')

    return [
      {
        id: c.id,
        propertyName: property.name,
        dates: `${shortDate(c.check_in)} → ${shortDate(c.check_out)}`,
        guestsText,
        total,
        name: c.guest_name ?? '',
        phone: c.guest_phone ?? '',
        email: c.guest_email ?? '',
        notes: c.guest_notes ?? '',
        coupon: c.discount_code,
        stage: c.stage,
        lastError: c.last_error,
        status: c.status,
        updatedAt: c.updated_at,
        hostNotified: Boolean(c.host_notified_at),
        guestEmailedAt: c.guest_emailed_at,
        datesFree: free,
        datesPast: c.check_in < today,
        whatsappLink: cartWhatsAppLink(c, property),
        whatsappMessage: cartWhatsAppMessage(c, property),
        resumeUrl,
        copyText,
      },
    ]
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-navy-deep">Carritos abandonados</h1>
        <p className="text-sm text-stone mt-1">
          Huéspedes que llenaron sus datos para reservar pero no terminaron de pagar. Te llega un correo cuando
          pasan {ABANDON_AFTER_MINUTES} minutos sin reservar, o al instante si les rechazan la tarjeta.
        </p>
      </div>
      <CartsManager carts={views} autoEmail={Boolean(hostRow?.cart_auto_email)} showAll={showAll} />
    </div>
  )
}
