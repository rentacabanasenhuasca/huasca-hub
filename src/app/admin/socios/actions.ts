'use server'

import { revalidatePath } from 'next/cache'
import { requireHost } from '@/lib/hosts'
import { createServiceClient } from '@/lib/supabase/service'
import { escapeHtml, mxn, sendPlainEmail, maskClabe } from '@/lib/partners'
import { SITE_URL } from '@/lib/site'

type Result = { error: string | null }

async function partnerOf(service: ReturnType<typeof createServiceClient>, partnerId: string) {
  const { data } = await service.from('partners').select('id, name, email, bank_clabe, bank_name').eq('id', partnerId).maybeSingle()
  return data
}

export async function approvePartnerProperty(propertyId: string): Promise<Result> {
  await requireHost()
  const service = createServiceClient()
  const { data: p } = await service.from('properties').select('id, name, slug, partner_id').eq('id', propertyId).maybeSingle()
  if (!p?.partner_id) return { error: 'Esa cabaña no es de un socio.' }
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
