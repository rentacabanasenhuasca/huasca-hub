// Carritos abandonados: alguien llenó sus datos en "Confirma y paga" pero no
// terminó de pagar. Aquí vive todo lo del lado del servidor:
//   - guardar/actualizar el carrito mientras el huésped llena el checkout,
//   - marcar en qué etapa se quedó (datos, pago iniciado, pago rechazado,
//     reservado),
//   - avisarle al anfitrión por correo (a los 20 minutos sin reservar, o al
//     instante si le rechazaron la tarjeta),
//   - mandarle al huésped el correo de "¿se te complicó tu reserva?" con la
//     liga para retomarla (a mano desde el panel, o automático si el
//     anfitrión lo encendió en /admin/carritos).
// Nunca debe tronar el checkout: todo es "mejor esfuerzo".
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import { sendEmail } from '@/lib/email'
import { wrapBrandedEmail } from '@/lib/booking-emails'
import { LOGO_CID, LOGO_PNG_BASE64 } from '@/lib/email-logo'
import { SITE_URL } from '@/lib/site'
import { isUuid } from '@/lib/is-uuid'

export const ABANDON_AFTER_MINUTES = 20

export type CartStage = 'datos' | 'pago_iniciado' | 'pago_rechazado' | 'reservado'
export type CartStatus = 'abierto' | 'contactado' | 'recuperado' | 'descartado'

export type CartInput = {
  cartId: string
  propertyId: string
  checkin: string
  checkout: string
  guests: { adults: number; children: number; infants: number; pets: number }
  guestInfo: { name: string; email: string; phone: string; notes?: string }
  addonSelections: { addonId: string; quantity: number }[]
  discountCode?: string | null
  quotedTotal: number
}

export type CartRow = {
  id: string
  host_id: string
  property_id: string
  check_in: string
  check_out: string
  adults: number
  children: number
  infants: number
  pets: number
  discount_code: string | null
  quoted_total_mxn: number | null
  guest_name: string | null
  guest_email: string | null
  guest_phone: string | null
  guest_notes: string | null
  stage: CartStage
  payment_provider: string | null
  last_error: string | null
  booking_id: string | null
  status: CartStatus
  host_notified_at: string | null
  guest_emailed_at: string | null
  contacted_at: string | null
  created_at: string
  updated_at: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const clip = (s: string | null | undefined, n: number) => (s ?? '').trim().slice(0, n)
const int = (n: unknown, max: number) => Math.max(0, Math.min(max, Math.floor(Number(n) || 0)))

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function money(n: number | null | undefined) {
  return `$${Math.round(Number(n ?? 0)).toLocaleString('es-MX')} MXN`
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export function shortDate(date: string) {
  const [, m, d] = date.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]}`
}

/** Liga para que el huésped retome su reserva con todo ya llenado. */
export function cartResumeUrl(cart: Pick<CartRow, 'id' | 'check_in' | 'check_out' | 'adults' | 'children' | 'infants' | 'pets'>, slug: string) {
  const params = new URLSearchParams({
    checkin: cart.check_in,
    checkout: cart.check_out,
    adults: String(cart.adults),
    children: String(cart.children),
    infants: String(cart.infants),
    pets: String(cart.pets),
    carrito: cart.id,
  })
  return `${SITE_URL}/cabanas/${slug}/reservar?${params.toString()}`
}

/** Guarda (o actualiza) el carrito mientras el huésped llena sus datos. */
export async function saveCart(input: CartInput) {
  if (!isUuid(input.cartId) || !isUuid(input.propertyId)) return { ok: false as const }
  if (!DATE_RE.test(input.checkin) || !DATE_RE.test(input.checkout) || input.checkout <= input.checkin) {
    return { ok: false as const }
  }
  const supabase = createServiceClient()

  const { data: property } = await supabase
    .from('properties')
    .select('id, host_id')
    .eq('id', input.propertyId)
    .eq('status', 'published')
    .maybeSingle()
  if (!property) return { ok: false as const }

  const { data: existing } = await supabase
    .from('checkout_carts')
    .select('id, stage, property_id')
    .eq('id', input.cartId)
    .maybeSingle()
  // Un carrito ya convertido en reserva no se vuelve a tocar, y un id no se
  // puede "reusar" para otra cabaña.
  if (existing && (existing.stage === 'reservado' || existing.property_id !== property.id)) {
    return { ok: false as const }
  }

  const row = {
    id: input.cartId,
    host_id: property.host_id,
    property_id: property.id,
    check_in: input.checkin,
    check_out: input.checkout,
    adults: Math.max(1, int(input.guests.adults, 50)),
    children: int(input.guests.children, 50),
    infants: int(input.guests.infants, 50),
    pets: int(input.guests.pets, 10),
    addon_selections: (input.addonSelections ?? []).slice(0, 30).map((a) => ({
      addonId: clip(a.addonId, 40),
      quantity: int(a.quantity, 99),
    })),
    discount_code: clip(input.discountCode, 40) || null,
    quoted_total_mxn: Math.max(0, Math.min(10_000_000, Number(input.quotedTotal) || 0)),
    guest_name: clip(input.guestInfo.name, 120),
    guest_email: clip(input.guestInfo.email, 200).toLowerCase(),
    guest_phone: clip(input.guestInfo.phone, 40),
    guest_notes: clip(input.guestInfo.notes, 1000) || null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('checkout_carts').upsert(row, { onConflict: 'id' })
  if (error) {
    console.warn('[carritos] no se pudo guardar:', error.message)
    return { ok: false as const }
  }
  return { ok: true as const }
}

/** Marca la etapa del carrito (pago iniciado / rechazado / reservado). */
export async function markCart(
  cartId: string,
  stage: Exclude<CartStage, 'datos'>,
  opts: { provider?: string | null; error?: string | null; bookingId?: string | null } = {}
) {
  if (!isUuid(cartId)) return
  const supabase = createServiceClient()
  const { data: cart } = await supabase.from('checkout_carts').select('*').eq('id', cartId).maybeSingle()
  if (!cart || cart.stage === 'reservado') return

  const update: Record<string, unknown> = { stage, updated_at: new Date().toISOString() }
  if (opts.provider) update.payment_provider = clip(opts.provider, 20)
  if (stage === 'pago_rechazado') update.last_error = clip(opts.error, 300) || 'Pago rechazado'

  if (stage === 'reservado') {
    // Solo se acepta "reservado" si de verdad existe esa reserva confirmada
    // para la misma cabaña y fechas (el navegador no puede inventarla).
    if (!opts.bookingId || !isUuid(opts.bookingId)) return
    const { data: booking } = await supabase
      .from('bookings')
      .select('id')
      .eq('id', opts.bookingId)
      .eq('property_id', cart.property_id)
      .eq('check_in', cart.check_in)
      .eq('status', 'confirmed')
      .maybeSingle()
    if (!booking) return
    update.booking_id = booking.id
    update.status = cart.status === 'abierto' ? 'abierto' : 'recuperado'
  }

  await supabase.from('checkout_carts').update(update).eq('id', cartId)

  // Tarjeta rechazada: es el carrito más fácil de recuperar, se avisa al
  // instante en vez de esperar los 20 minutos.
  if (stage === 'pago_rechazado' && !cart.host_notified_at) {
    await notifyHost(supabase, { ...cart, ...update } as CartRow).catch(() => {})
  }
}

type PropertyInfo = { name: string; slug: string }

async function loadContext(supabase: SupabaseClient, cart: CartRow) {
  const [{ data: property }, { data: host }] = await Promise.all([
    supabase.from('properties').select('name, slug').eq('id', cart.property_id).maybeSingle(),
    supabase.from('hosts').select('name, email, phone, cart_auto_email').eq('id', cart.host_id).maybeSingle(),
  ])
  return { property: property as PropertyInfo | null, host }
}

const STAGE_LABELS: Record<CartStage, string> = {
  datos: 'Llenó sus datos',
  pago_iniciado: 'Inició el pago',
  pago_rechazado: 'Pago rechazado',
  reservado: 'Reservó',
}

const logoAttachment = () => [
  { filename: 'huasca-retreats.png', content: Buffer.from(LOGO_PNG_BASE64, 'base64'), cid: LOGO_CID, contentType: 'image/png' },
]

function waLink(phone: string, text: string) {
  let digits = phone.replace(/[^\d]/g, '')
  if (digits.length === 10) digits = `52${digits}`
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

export function cartWhatsAppMessage(cart: CartRow, property: PropertyInfo) {
  const firstName = (cart.guest_name ?? '').split(' ')[0] || ''
  return `Hola ${firstName}, soy de Huasca Retreats. Vi que estabas reservando ${property.name} del ${shortDate(
    cart.check_in
  )} al ${shortDate(cart.check_out)}. ¿Te puedo ayudar con algo para terminar tu reserva? Aquí la puedes retomar con tus datos ya llenos: ${cartResumeUrl(
    cart,
    property.slug
  )}`
}

export function cartWhatsAppLink(cart: CartRow, property: PropertyInfo) {
  return cart.guest_phone ? waLink(cart.guest_phone, cartWhatsAppMessage(cart, property)) : null
}

/** Correo para el anfitrión: "alguien dejó una reserva a medias". */
async function notifyHost(supabase: SupabaseClient, cart: CartRow) {
  const { property, host } = await loadContext(supabase, cart)
  if (!property || !host?.email) return
  const wa = cartWhatsAppLink(cart, property)
  const failed = cart.stage === 'pago_rechazado'

  const rows: [string, string][] = [
    ['Cabaña', property.name],
    ['Fechas', `${shortDate(cart.check_in)} → ${shortDate(cart.check_out)}`],
    ['Huéspedes', `${cart.adults} adultos${cart.children ? `, ${cart.children} niños` : ''}${cart.infants ? `, ${cart.infants} bebés` : ''}${cart.pets ? `, ${cart.pets} mascota(s)` : ''}`],
    ['Total cotizado', money(cart.quoted_total_mxn)],
    ['Nombre', cart.guest_name ?? ''],
    ['Teléfono', cart.guest_phone ?? ''],
    ['Correo', cart.guest_email ?? ''],
    ['Etapa', STAGE_LABELS[cart.stage] + (failed && cart.last_error ? ` (${cart.last_error})` : '')],
  ]
  if (cart.discount_code) rows.push(['Cupón', cart.discount_code])
  if (cart.guest_notes) rows.push(['Notas', cart.guest_notes])

  const body = `
    <p style="margin:0 0 16px 0;"><strong>${failed ? 'Le rechazaron el pago a un huésped' : 'Alguien dejó una reserva a medias'}</strong></p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;margin:0 0 20px 0;">
      ${rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:4px 12px 4px 0;color:#6b6459;white-space:nowrap;vertical-align:top;">${k}</td><td style="padding:4px 0;">${escapeHtml(v)}</td></tr>`
        )
        .join('')}
    </table>
    ${
      wa
        ? `<p style="margin:0 0 12px 0;"><a href="${wa}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:999px;font-weight:600;">Escribirle por WhatsApp</a></p>`
        : ''
    }
    <p style="margin:0;"><a href="${SITE_URL}/admin/carritos" style="color:#c9a24a;">Ver todos los carritos en el panel</a></p>`

  const result = await sendEmail({
    to: [host.email],
    subject: `${failed ? 'Pago rechazado' : 'Carrito abandonado'}: ${cart.guest_name ?? 'huésped'} · ${property.name} ${shortDate(cart.check_in)}`,
    html: wrapBrandedEmail(body),
    attachments: logoAttachment(),
  })
  if (result.ok) {
    await supabase.from('checkout_carts').update({ host_notified_at: new Date().toISOString() }).eq('id', cart.id)
  }
}

/** Correo para el huésped con la liga para retomar su reserva. */
export async function sendCartGuestEmail(cartId: string, supabase: SupabaseClient = createServiceClient()) {
  const { data: cart } = await supabase.from('checkout_carts').select('*').eq('id', cartId).maybeSingle()
  if (!cart) return { ok: false as const, error: 'No se encontró el carrito.' }
  if (!cart.guest_email) return { ok: false as const, error: 'Este carrito no tiene correo.' }
  if (cart.stage === 'reservado') return { ok: false as const, error: 'Este huésped ya reservó.' }
  const { property, host } = await loadContext(supabase, cart as CartRow)
  if (!property) return { ok: false as const, error: 'La cabaña ya no existe.' }

  const firstName = escapeHtml((cart.guest_name ?? '').split(' ')[0] || '')
  const url = cartResumeUrl(cart as CartRow, property.slug)
  const wa = host?.phone
    ? waLink(host.phone, `Hola, estaba reservando ${property.name} del ${shortDate(cart.check_in)} al ${shortDate(cart.check_out)} y tengo una duda.`)
    : null

  const body = `
    <p style="margin:0 0 16px 0;">Hola ${firstName},</p>
    <p style="margin:0 0 16px 0;">Vimos que estabas reservando <strong>${escapeHtml(property.name)}</strong> del <strong>${shortDate(
      cart.check_in
    )}</strong> al <strong>${shortDate(cart.check_out)}</strong> y no se completó tu reserva. ¿Se te complicó algo?</p>
    <p style="margin:0 0 20px 0;">Te guardamos tus datos para que la termines en un minuto:</p>
    <p style="margin:0 0 24px 0;"><a href="${url}" style="display:inline-block;background:#c9a24a;color:#141c15;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;">Terminar mi reserva</a></p>
    ${
      wa
        ? `<p style="margin:0 0 16px 0;">Si tuviste algún problema con el pago o tienes dudas, escríbenos por <a href="${wa}" style="color:#c9a24a;">WhatsApp</a> y te ayudamos.</p>`
        : ''
    }
    <p style="margin:0;color:#6b6459;font-size:13px;">Las fechas no quedan apartadas hasta completar el pago.</p>`

  const result = await sendEmail({
    to: [cart.guest_email],
    subject: `Tu reserva en ${property.name} quedó pendiente`,
    html: wrapBrandedEmail(body),
    attachments: logoAttachment(),
  })
  if (!result.ok) return { ok: false as const, error: result.error }
  await supabase.from('checkout_carts').update({ guest_emailed_at: new Date().toISOString() }).eq('id', cartId)
  return { ok: true as const }
}

/**
 * Revisa los carritos que llevan 20+ minutos sin convertirse en reserva:
 * avisa al anfitrión y, si tiene encendido el correo automático, le manda
 * el correo de recuperación al huésped. Corre cada 5 minutos desde
 * instrumentation.ts (y también se puede llamar por /api/cron/carritos).
 */
export async function processAbandonedCarts() {
  const supabase = createServiceClient()
  const cutoff = new Date(Date.now() - ABANDON_AFTER_MINUTES * 60_000).toISOString()
  const since = new Date(Date.now() - 3 * 24 * 3600_000).toISOString()

  const { data: carts } = await supabase
    .from('checkout_carts')
    .select('*')
    .in('stage', ['datos', 'pago_iniciado', 'pago_rechazado'])
    .eq('status', 'abierto')
    .lt('updated_at', cutoff)
    .gt('updated_at', since)
    .or('host_notified_at.is.null,guest_emailed_at.is.null')
    .limit(50)

  let notified = 0
  let emailed = 0
  for (const cart of (carts ?? []) as CartRow[]) {
    try {
      // Red de seguridad: si ya existe una reserva confirmada de ese mismo
      // huésped para esa cabaña y fecha, el carrito sí se convirtió.
      if (cart.guest_email) {
        const { data: booking } = await supabase
          .from('bookings')
          .select('id')
          .eq('property_id', cart.property_id)
          .eq('check_in', cart.check_in)
          .eq('status', 'confirmed')
          .ilike('guest_email', cart.guest_email)
          .gte('created_at', cart.created_at)
          .limit(1)
          .maybeSingle()
        if (booking) {
          await supabase.from('checkout_carts').update({ stage: 'reservado', booking_id: booking.id }).eq('id', cart.id)
          continue
        }
      }

      if (!cart.host_notified_at) {
        await notifyHost(supabase, cart)
        notified += 1
      }
      // El correo automático al huésped solo sale para carritos recientes
      // (menos de 24 h): si se enciende el interruptor, no se le escribe de
      // golpe a gente que abandonó hace días.
      const recent = Date.now() - new Date(cart.updated_at).getTime() < 24 * 3600_000
      if (!cart.guest_emailed_at && cart.guest_email && recent) {
        const { data: host } = await supabase.from('hosts').select('cart_auto_email').eq('id', cart.host_id).maybeSingle()
        if (host?.cart_auto_email) {
          const r = await sendCartGuestEmail(cart.id, supabase)
          if (r.ok) emailed += 1
        }
      }
    } catch (err) {
      console.warn('[carritos] fallo procesando', cart.id, (err as Error).message)
    }
  }
  return { checked: carts?.length ?? 0, notified, emailed }
}

/**
 * Trae a la lista de carritos los pagos de Stripe que se quedaron a medias
 * (incompletos o con tarjeta rechazada) de los últimos días. Sirve para
 * recuperar lo que pasó antes de que existiera el seguimiento de carritos.
 * No manda ningún aviso: solo los agrega al panel. Si un pago ya terminó en
 * reserva, o ya está en la lista, no se duplica.
 */
export async function importStripeCarts(hostId: string, days = 10) {
  const { getStripe } = await import('@/lib/stripe')
  const stripe = getStripe()
  const supabase = createServiceClient()
  const since = Math.floor(Date.now() / 1000) - days * 86400

  const { data: properties } = await supabase.from('properties').select('id').eq('host_id', hostId)
  const ownProperties = new Set((properties ?? []).map((p) => p.id))

  let imported = 0
  let skipped = 0
  for await (const pi of stripe.paymentIntents.list({ created: { gte: since }, limit: 100, expand: ['data.customer'] })) {
    if (pi.status === 'succeeded' || pi.status === 'canceled') continue
    const meta = pi.metadata ?? {}
    const propertyId = meta.property_id
    if (!propertyId || !ownProperties.has(propertyId) || !DATE_RE.test(meta.checkin ?? '') || !DATE_RE.test(meta.checkout ?? '')) {
      skipped += 1
      continue
    }

    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('stripe_payment_intent_id', pi.id)
      .limit(1)
      .maybeSingle()
    if (existingBooking) continue

    const customer = typeof pi.customer === 'object' && pi.customer && !('deleted' in pi.customer && pi.customer.deleted)
      ? (pi.customer as { name?: string | null; email?: string | null; phone?: string | null })
      : null
    const email = (customer?.email ?? meta.guest_email ?? '').toLowerCase()

    // Si ese huésped terminó reservando después (con otro intento de pago),
    // no es un carrito abandonado.
    if (email) {
      const { data: laterBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('property_id', propertyId)
        .eq('check_in', meta.checkin)
        .eq('status', 'confirmed')
        .ilike('guest_email', email)
        .limit(1)
        .maybeSingle()
      if (laterBooking) continue
    }

    const createdIso = new Date(pi.created * 1000).toISOString()
    const failed = Boolean(pi.last_payment_error)
    const { error } = await supabase.from('checkout_carts').upsert(
      {
        id: crypto.randomUUID(),
        stripe_payment_intent_id: pi.id,
        host_id: hostId,
        property_id: propertyId,
        check_in: meta.checkin,
        check_out: meta.checkout,
        adults: 1,
        quoted_total_mxn: pi.amount / 100,
        guest_name: clip(customer?.name ?? meta.guest_name, 120),
        guest_email: email || null,
        guest_phone: clip(customer?.phone, 40) || null,
        guest_notes: 'Importado de Stripe (sin número de huéspedes)',
        stage: failed ? 'pago_rechazado' : 'pago_iniciado',
        payment_provider: 'stripe',
        last_error: failed ? clip(pi.last_payment_error?.message, 300) : null,
        host_notified_at: new Date().toISOString(),
        created_at: createdIso,
        updated_at: createdIso,
      },
      { onConflict: 'stripe_payment_intent_id', ignoreDuplicates: true }
    )
    if (error) console.warn('[carritos] import stripe', pi.id, error.message)
    else imported += 1
  }
  return { imported, skipped }
}
