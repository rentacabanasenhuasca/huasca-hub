'use server'

import { revalidatePath } from 'next/cache'
import { requireHost } from '@/lib/hosts'
import { createServiceClient } from '@/lib/supabase/service'
import { escapeHtml, guestPrice, mxn, sendPlainEmail, maskClabe } from '@/lib/partners'
import { recomputeCalendarRange } from '@/lib/calendar'
import { todayInMexicoStr } from '@/lib/dates'
import { SITE_URL } from '@/lib/site'

type Result = { error: string | null }

async function partnerOf(service: ReturnType<typeof createServiceClient>, partnerId: string) {
  const { data } = await service.from('partners').select('id, name, email, bank_clabe, bank_name').eq('id', partnerId).maybeSingle()
  return data
}

// Precio al huésped, calificación y tipo de una cabaña de socio. Solo el
// anfitrión lo ve: el socio sigue viendo únicamente su propio precio y lo que
// recibe (su pago sale de su precio, no del que ve el huésped).
export async function setPartnerPricing(
  propertyId: string,
  markupPct: number,
  rating: number | null,
  tier: string | null
): Promise<Result> {
  await requireHost()
  const service = createServiceClient()
  const { data: p } = await service
    .from('properties')
    .select('id, partner_id, partner_price_weekday, partner_price_weekend')
    .eq('id', propertyId)
    .maybeSingle()
  if (!p?.partner_id) return { error: 'Esa cabaña no es de un socio.' }
  const markup = Number(markupPct)
  if (!Number.isFinite(markup) || markup < 0 || markup > 300) return { error: 'El margen debe estar entre 0% y 300%.' }
  const r = rating == null ? null : Number(rating)
  if (r != null && (!Number.isFinite(r) || r < 1 || r > 5)) return { error: 'La calificación va de 1 a 5.' }
  const t = tier && ['accesible', 'media', 'lujo'].includes(tier) ? tier : null

  const { error } = await service
    .from('properties')
    .update({
      partner_markup_pct: Math.round(markup * 10) / 10,
      weekday_price_mxn: guestPrice(Number(p.partner_price_weekday), markup),
      weekend_price_mxn: guestPrice(Number(p.partner_price_weekend), markup),
      admin_rating: r == null ? null : Math.round(r * 10) / 10,
      price_tier: t,
      updated_at: new Date().toISOString(),
    })
    .eq('id', propertyId)
  if (error) return { error: `No se pudo guardar: ${error.message}` }

  const today = todayInMexicoStr()
  const end = new Date(`${today}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 400)
  await recomputeCalendarRange(service, [propertyId], today, end.toISOString().slice(0, 10))
  revalidatePath('/admin/socios')
  revalidatePath('/')
  return { error: null }
}

export async function approvePartnerProperty(propertyId: string): Promise<Result> {
  await requireHost()
  const service = createServiceClient()
  const { data: p } = await service
    .from('properties')
    .select('id, name, slug, partner_id, arrival_instructions, google_maps_link')
    .eq('id', propertyId)
    .maybeSingle()
  if (!p?.partner_id) return { error: 'Esa cabaña no es de un socio.' }
  // Sin indicaciones para llegar no se publica: van en el correo del huésped.
  if (!p.google_maps_link || ((p.arrival_instructions as string | null) ?? '').trim().length < 80) {
    return { error: 'Falta que el socio ponga su ubicación de Google Maps y cómo llegar. Pídele que edite su cabaña.' }
  }
  const { error } = await service
    .from('properties')
    .update({ partner_state: 'active', status: 'published', partner_approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', propertyId)
  if (error) return { error: error.message }
  const partner = await partnerOf(service, p.partner_id as string)
  if (partner?.email) {
    await sendPlainEmail(partner.email, `¡Tu cabaña ${p.name} ya está publicada en Huasca Retreats!`, [
      `Hola ${escapeHtml(partner.name)},`,
      `Revisamos tu cabaña <strong>${escapeHtml(p.name as string)}</strong> y ya está publicada: <a href="${SITE_URL}/cabanas/${p.slug}">${SITE_URL}/cabanas/${p.slug}</a>`,
      `Recuerda: mantén tu calendario al día (conecta Airbnb/Booking o bloquea en tu panel cada fecha que reserves por fuera). Cuando te reserven te llegará un correo con los datos.`,
      `Tu panel: <a href="${SITE_URL}/socios">${SITE_URL}/socios</a>`,
    ])
  }
  revalidatePath('/admin/socios')
  revalidatePath('/')
  return { error: null }
}

export async function verifyPartnerBank(partnerId: string, verified: boolean): Promise<Result> {
  await requireHost()
  const service = createServiceClient()
  const { error } = await service
    .from('partners')
    .update({ bank_verified_at: verified ? new Date().toISOString() : null })
    .eq('id', partnerId)
  if (error) return { error: error.message }
  if (verified) {
    const partner = await partnerOf(service, partnerId)
    if (partner?.email) {
      await sendPlainEmail(partner.email, 'Tus datos de pago quedaron verificados', [
        `Hola ${escapeHtml(partner.name)},`,
        `Verificamos tu cuenta ${escapeHtml(partner.bank_name ?? '')} ${maskClabe(partner.bank_clabe)}. Ahí te depositaremos tus reservas al día siguiente de cada check-in.`,
      ])
    }
  }
  revalidatePath('/admin/socios')
  return { error: null }
}

export async function setPartnerAccountStatus(partnerId: string, status: 'active' | 'suspended'): Promise<Result> {
  await requireHost()
  const service = createServiceClient()
  const { error } = await service.from('partners').update({ status }).eq('id', partnerId)
  if (error) return { error: error.message }
  if (status === 'suspended') {
    // Sus cabañas dejan de aparecer en el sitio.
    await service
      .from('properties')
      .update({ status: 'draft', partner_state: 'paused' })
      .eq('partner_id', partnerId)
      .in('partner_state', ['active', 'review'])
  }
  revalidatePath('/admin/socios')
  revalidatePath('/')
  return { error: null }
}

// Borrar a un socio por completo: su cuenta, su acceso, el de su equipo y sus
// documentos. Sus cabañas se archivan (salen del sitio) y las reservas pasadas
// se quedan en el historial. No se puede si tiene reservas por venir o pagos
// pendientes: primero hay que resolverlos.
export async function deletePartner(partnerId: string): Promise<Result> {
  await requireHost()
  const service = createServiceClient()
  const { data: partner } = await service.from('partners').select('id, user_id, name').eq('id', partnerId).maybeSingle()
  if (!partner) return { error: 'No se encontró el socio.' }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
  const { data: props } = await service.from('properties').select('id').eq('partner_id', partnerId)
  const propIds = (props ?? []).map((p) => p.id as string)
  if (propIds.length > 0) {
    const { count: upcoming } = await service
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .in('property_id', propIds)
      .eq('status', 'confirmed')
      .gte('check_out', today)
    if (upcoming) {
      return { error: `Tiene ${upcoming} reserva(s) por venir. Cancélalas o muévelas a otra cabaña antes de borrarlo.` }
    }
  }
  const { count: unpaid } = await service
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('partner_id', partnerId)
    .eq('status', 'confirmed')
    .is('partner_paid_at', null)
    .gt('partner_payout_mxn', 0)
  if (unpaid) return { error: `Tienes ${unpaid} pago(s) pendientes con este socio. Márcalos como pagados antes de borrarlo.` }

  // Sus cabañas salen del sitio y se archivan.
  if (propIds.length > 0) {
    await service
      .from('properties')
      .update({ status: 'draft', partner_state: 'removed', archived_at: new Date().toISOString() })
      .in('id', propIds)
  }
  // Acceso de su equipo.
  const { data: team } = await service.from('staff_members').select('user_id').eq('created_by_partner_id', partnerId)
  for (const m of team ?? []) await service.auth.admin.deleteUser(m.user_id as string)
  // Comprobantes bancarios.
  const { data: docs } = await service.storage.from('partner-docs').list(partner.user_id as string)
  if (docs?.length) await service.storage.from('partner-docs').remove(docs.map((d) => `${partner.user_id}/${d.name}`))

  const { error } = await service.from('partners').delete().eq('id', partnerId)
  if (error) return { error: `No se pudo borrar: ${error.message}` }
  await service.auth.admin.deleteUser(partner.user_id as string)

  revalidatePath('/admin/socios')
  revalidatePath('/')
  return { error: null }
}

export async function markPartnerPayout(bookingId: string, paid: boolean, ref: string): Promise<Result> {
  await requireHost()
  const service = createServiceClient()
  const { data: b } = await service
    .from('bookings')
    .select('id, check_in, check_out, guest_name, partner_id, partner_payout_mxn, properties(name)')
    .eq('id', bookingId)
    .maybeSingle()
  if (!b?.partner_id) return { error: 'Esa reserva no es de un socio.' }
  const { error } = await service
    .from('bookings')
    .update(paid ? { partner_paid_at: new Date().toISOString(), partner_paid_ref: ref.trim() || null } : { partner_paid_at: null, partner_paid_ref: null })
    .eq('id', bookingId)
  if (error) return { error: error.message }

  if (paid) {
    const partner = await partnerOf(service, b.partner_id as string)
    const prop = Array.isArray(b.properties) ? b.properties[0] : b.properties
    if (partner?.email) {
      await sendPlainEmail(partner.email, `Te depositamos ${mxn(Number(b.partner_payout_mxn ?? 0))} — ${prop?.name ?? 'tu cabaña'}`, [
        `Hola ${escapeHtml(partner.name)},`,
        `Te transferimos <strong>${mxn(Number(b.partner_payout_mxn ?? 0))}</strong> por la reserva de ${escapeHtml(b.guest_name ?? 'tu huésped')} en ${escapeHtml(prop?.name ?? 'tu cabaña')} (${b.check_in} → ${b.check_out}).`,
        `Cuenta: ${escapeHtml(partner.bank_name ?? '')} ${maskClabe(partner.bank_clabe)}${ref.trim() ? `<br />Referencia / clave de rastreo: ${escapeHtml(ref.trim())}` : ''}`,
        `¡Gracias por ser socio de Huasca Retreats!`,
      ])
    }
  }
  revalidatePath('/admin/socios')
  return { error: null }
}
