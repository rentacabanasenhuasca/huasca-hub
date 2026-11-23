'use server'

// Acciones del panel de socios (/socios). Todo pasa por el servidor con la
// service key, revisando siempre que la cabaña sea del socio que la toca.
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  PARTNER_FEE_PCT,
  PARTNER_MARKUP_PCT,
  adminEmail,
  escapeHtml,
  findPartnerByUserId,
  guestPrice,
  maskClabe,
  notifyAdmin,
  partnerProperty,
  requirePartner,
  validateClabe,
} from '@/lib/partners'
import { generateUniqueSlug } from '@/lib/slug'
import { recomputeCalendarRange } from '@/lib/calendar'
import { todayInMexicoStr } from '@/lib/dates'
import { guessPlatform } from '@/lib/ical'
import { syncOneIcalSource } from '@/lib/ical-sync'
import { SITE_URL } from '@/lib/site'

type Result = { error: string | null }
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function num(formData: FormData, field: string): number | null {
  const raw = formData.get(field)
  if (raw === null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ---- Registro --------------------------------------------------------------
export async function registerPartner(_prev: Result, formData: FormData): Promise<Result> {
  const name = String(formData.get('name') || '').trim()
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const phone = String(formData.get('phone') || '').trim()
  const password = String(formData.get('password') || '')
  const terms = formData.get('terms') === 'on'

  if (!name || !email || !phone) return { error: 'Llena tu nombre, correo y teléfono.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Ese correo no parece válido.' }
  if (password.length < 8) return { error: 'La contraseña debe tener al menos 8 caracteres.' }
  if (!terms) return { error: 'Para registrarte necesitas aceptar los términos para socios.' }

  const service = createServiceClient()
  const { data: created, error: authError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: 'partner' },
  })
  if (authError || !created.user) {
    const msg = authError?.message ?? ''
    if (/already|registered|exists/i.test(msg)) {
      return { error: 'Ya existe una cuenta con ese correo. Entra con tu contraseña en huascaretreats.com/login.' }
    }
    return { error: `No se pudo crear tu cuenta: ${msg}` }
  }

  const { error: insertError } = await service.from('partners').insert({
    user_id: created.user.id,
    name,
    email,
    phone,
    terms_accepted_at: new Date().toISOString(),
  })
  if (insertError) {
    await service.auth.admin.deleteUser(created.user.id)
    return { error: `No se pudo crear tu cuenta: ${insertError.message}` }
  }

  const supabase = await createClient()
  await supabase.auth.signInWithPassword({ email, password })

  await notifyAdmin(`Nuevo socio registrado: ${name}`, [
    `<strong>${escapeHtml(name)}</strong> se registró como socio.`,
    `Correo: ${escapeHtml(email)}<br />Teléfono: ${escapeHtml(phone)}`,
    `Revísalo en <a href="${SITE_URL}/admin/socios">${SITE_URL}/admin/socios</a>.`,
  ])

  redirect('/socios?bienvenido=1')
}

// ---- Datos de pago -----------------------------------------------------------
export async function savePartnerBank(_prev: Result, formData: FormData): Promise<Result> {
  const partner = await requirePartner()
  const holder = String(formData.get('bank_holder') || '').trim()
  const rfc = String(formData.get('bank_rfc') || '').trim().toUpperCase()
  const proofPath = String(formData.get('bank_proof_path') || '').trim()
  const check = validateClabe(String(formData.get('bank_clabe') || ''))

  if (!holder) return { error: 'Escribe el nombre del titular de la cuenta, tal como aparece en tu estado de cuenta.' }
  if (!check.ok) return { error: check.error }
  if (rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc)) return { error: 'Ese RFC no tiene el formato correcto (puedes dejarlo vacío).' }
  if (!proofPath) return { error: 'Sube la carátula de tu estado de cuenta para poder verificar la cuenta.' }
  if (!proofPath.startsWith(`${partner.user_id}/`)) return { error: 'Archivo no válido. Vuelve a subirlo.' }

  const changed = check.clabe !== partner.bank_clabe || holder !== partner.bank_holder || proofPath !== partner.bank_proof_path
  const service = createServiceClient()
  const { error } = await service
    .from('partners')
    .update({
      bank_holder: holder,
      bank_name: check.bank,
      bank_clabe: check.clabe,
      bank_rfc: rfc || null,
      bank_proof_path: proofPath,
      bank_updated_at: new Date().toISOString(),
      ...(changed ? { bank_verified_at: null } : {}),
    })
    .eq('id', partner.id)
  if (error) return { error: `No se pudieron guardar tus datos: ${error.message}` }

  if (changed) {
    await notifyAdmin(`Datos de pago por verificar: ${partner.name}`, [
      `<strong>${escapeHtml(partner.name)}</strong> ${partner.bank_clabe ? 'cambió' : 'registró'} sus datos de pago.`,
      `Titular: ${escapeHtml(holder)}<br />Banco: ${escapeHtml(check.bank ?? 'no identificado')}<br />CLABE: ${maskClabe(check.clabe)}`,
      `Revisa el comprobante y márcalos como verificados en <a href="${SITE_URL}/admin/socios">${SITE_URL}/admin/socios</a>. Mientras no estén verificados, no se le pueden pagar reservas.`,
    ])
  }

  revalidatePath('/socios')
  return { error: null }
}

// ---- Cabaña ------------------------------------------------------------------
export async function savePartnerProperty(propertyId: string | null, _prev: Result, formData: FormData): Promise<Result> {
  const partner = await requirePartner()
  const service = createServiceClient()

  const name = String(formData.get('name') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const services = String(formData.get('services_text') || '').trim()
  const location = String(formData.get('location_text') || '').trim()
  const mapsLink = String(formData.get('google_maps_link') || '').trim()
  const weekday = num(formData, 'partner_price_weekday')
  const weekend = num(formData, 'partner_price_weekend')
  const minNights = Math.max(1, Math.min(30, num(formData, 'min_nights') ?? 1))
  const capacity = Math.max(1, num(formData, 'capacity') ?? 2)
  const bedrooms = Math.max(0, num(formData, 'bedrooms') ?? 1)
  const beds = Math.max(0, num(formData, 'beds') ?? 1)
  const bathrooms = Math.max(0, num(formData, 'bathrooms') ?? 1)
  const amenityIds = formData.getAll('amenity_ids').map(String)
  const photoUrls = formData
    .getAll('photo_url')
    .map(String)
    .map((u) => u.trim())
    .filter(Boolean)

  if (!name) return { error: 'Ponle nombre a tu cabaña.' }
  if (description.length < 40) return { error: 'Escribe una descripción de al menos un par de renglones.' }
  if (!location) return { error: 'Escribe la ubicación (zona, comunidad o dirección aproximada).' }
  if (!weekday || weekday < 300 || !weekend || weekend < 300) return { error: 'Pon tu precio por noche entre semana y en fin de semana.' }
  if (photoUrls.length < 3) return { error: 'Sube al menos 3 fotos de tu cabaña.' }
  const allowedPrefix = `/property-photos/partners/${partner.user_id}/`
  const ownPhotos = photoUrls.filter((u) => u.includes(allowedPrefix))

  // La descripción pública junta lo que escribió el socio, la ubicación y los
  // servicios extra, para que el huésped lo vea todo en la página.
  const fullDescription = [description, location ? `Ubicación: ${location}` : '', services ? `Servicios: ${services}` : '']
    .filter(Boolean)
    .join('\n\n')

  const payload = {
    name,
    description: fullDescription,
    capacity,
    base_occupancy: capacity,
    bedrooms,
    beds,
    bathrooms,
    pet_friendly: formData.get('pet_friendly') === 'on',
    google_maps_link: mapsLink || null,
    min_nights: minNights,
    partner_price_weekday: weekday,
    partner_price_weekend: weekend,
    weekday_price_mxn: guestPrice(weekday),
    weekend_price_mxn: guestPrice(weekend),
    updated_at: new Date().toISOString(),
  }

  let id = propertyId
  let isNew = false
  if (id) {
    const existing = await partnerProperty(partner.id, id)
    if (!existing) return { error: 'Esa cabaña no existe.' }
    if (existing.partner_state === 'removed') return { error: 'Esta cabaña fue quitada de la plataforma. Escríbenos para volver a activarla.' }
    const { error } = await service.from('properties').update(payload).eq('id', id)
    if (error) return { error: `No se pudo guardar: ${error.message}` }
  } else {
    const admin = await adminEmail()
    if (!admin) return { error: 'La plataforma no está lista para recibir cabañas. Avísanos por WhatsApp.' }
    const slug = await generateUniqueSlug(service, name)
    const { data: created, error } = await service
      .from('properties')
      .insert({
        ...payload,
        host_id: admin.id,
        slug,
        status: 'draft',
        booking_mode: 'online',
        cancellation_policy: 'moderada',
        extra_guest_fee_mxn: 0,
        partner_id: partner.id,
        partner_state: 'review',
        partner_markup_pct: PARTNER_MARKUP_PCT,
        partner_fee_pct: PARTNER_FEE_PCT,
      })
      .select('id')
      .single()
    if (error || !created) return { error: `No se pudo registrar tu cabaña: ${error?.message}` }
    id = created.id as string
    isNew = true
    await seedPartnerEmailTemplates(id, partner.email)
  }

  // Amenidades y fotos (se reemplazan completas, como en el panel del anfitrión).
  await service.from('property_amenities').delete().eq('property_id', id)
  if (amenityIds.length > 0) {
    await service.from('property_amenities').insert(amenityIds.map((amenity_id) => ({ property_id: id, amenity_id })))
  }
  const { data: prevPhotos } = await service.from('property_photos').select('url').eq('property_id', id)
  const prevSet = new Set((prevPhotos ?? []).map((p) => p.url as string))
  // Solo se aceptan fotos que subió este socio o que ya tenía la cabaña.
  const finalPhotos = photoUrls.filter((u) => ownPhotos.includes(u) || prevSet.has(u))
  await service.from('property_photos').delete().eq('property_id', id)
  if (finalPhotos.length > 0) {
    await service
      .from('property_photos')
      .insert(finalPhotos.map((url, i) => ({ property_id: id, url, sort_order: i })))
  }

  const today = todayInMexicoStr()
  await recomputeCalendarRange(service, [id!], today, addDays(today, 400))

  if (isNew) {
    await notifyAdmin(`Cabaña nueva por revisar: ${name}`, [
      `<strong>${escapeHtml(partner.name)}</strong> registró la cabaña <strong>${escapeHtml(name)}</strong>.`,
      `Precio del socio: $${weekday} entre semana / $${weekend} fin de semana.<br />El huésped verá: $${guestPrice(weekday)} / $${guestPrice(weekend)}.`,
      `Revísala y publícala en <a href="${SITE_URL}/admin/socios">${SITE_URL}/admin/socios</a>.`,
    ])
  } else {
    await notifyAdmin(`Un socio editó su cabaña: ${name}`, [
      `<strong>${escapeHtml(partner.name)}</strong> guardó cambios en <strong>${escapeHtml(name)}</strong>.`,
      `Precio del socio: $${weekday} / $${weekend} (huésped: $${guestPrice(weekday)} / $${guestPrice(weekend)}). Mínimo de noches: ${minNights}.`,
      `Puedes revisarla en <a href="${SITE_URL}/admin/propiedades/${id}">${SITE_URL}/admin/propiedades/${id}</a>.`,
    ])
  }

  revalidatePath('/socios')
  revalidatePath('/')
  if (isNew) redirect(`/socios/cabana/${id}?enviada=1`)
  return { error: null }
}

// Correos de reserva para la cabaña nueva: confirmación al huésped (igual que
// las cabañas propias) y aviso al administrador. El aviso al socio se manda
// aparte desde booking-emails.ts (con lo que le toca cobrar).
async function seedPartnerEmailTemplates(propertyId: string, _partnerEmail: string) {
  const service = createServiceClient()
  await service.from('email_templates').insert([
    {
      property_id: propertyId,
      name: 'Confirmación para el huésped',
      trigger_event: 'booking_created',
      recipient_type: 'guest',
      subject: 'Tu reserva en {{property_name}} está confirmada',
      body:
        'Hola {{guest_name}},\n\n' +
        '¡Tu reserva quedó confirmada! Aquí el resumen:\n\n' +
        'Cabaña: {{property_name}}\n' +
        'Llegada: {{check_in}}\n' +
        'Salida: {{check_out}}\n' +
        'Noches: {{nights}}\n' +
        'Huéspedes: {{adults}} adultos, {{children}} niños, {{infants}} infantes\n' +
        'Total pagado: {{total}}\n\n' +
        '{{addons}}\n\n' +
        'Cualquier duda, escríbenos a {{host_email}} o al {{host_phone}}.\n\n' +
        '¡Te esperamos en Huasca de Ocampo!',
      enabled: true,
    },
    {
      property_id: propertyId,
      name: 'Notificación para mí (administrador)',
      trigger_event: 'booking_created',
      recipient_type: 'admin',
      subject: 'Nueva reserva (socio): {{property_name}} ({{check_in}} — {{check_out}})',
      body:
        'Nueva reserva confirmada en una cabaña de socio.\n\n' +
        'Cabaña: {{property_name}}\n' +
        'Huésped: {{guest_name}} ({{guest_email}}, {{guest_phone}})\n' +
        'Llegada: {{check_in}}\n' +
        'Salida: {{check_out}}\n' +
        'Noches: {{nights}}\n' +
        'Huéspedes: {{adults}} adultos, {{children}} niños, {{infants}} infantes, mascotas: {{pets}}\n' +
        'Total cobrado: {{total}} · Pagado con: {{payment_provider}}\n' +
        'Notas del huésped: {{guest_notes}}\n\n' +
        '{{addons}}\n\n' +
        'ID de reserva: {{booking_id}}',
      enabled: true,
    },
  ])
}

export async function setPartnerPropertyState(propertyId: string, state: 'paused' | 'active' | 'removed'): Promise<Result> {
  const partner = await requirePartner()
  const property = await partnerProperty(partner.id, propertyId)
  if (!property) return { error: 'Esa cabaña no existe.' }
  const service = createServiceClient()

  if (state === 'removed') {
    const { count } = await service
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('status', 'confirmed')
      .gte('check_out', todayInMexicoStr())
    if (count && count > 0) {
      return {
        error: `Tienes ${count} reserva(s) futura(s) en esta cabaña. Primero hay que atenderlas: escríbenos por WhatsApp y vemos juntos qué hacer. Mientras, puedes pausarla para que no entren más.`,
      }
    }
  }

  let update: Record<string, unknown>
  if (state === 'active') {
    if (!property.partner_approved_at) return { error: 'Tu cabaña todavía está en revisión. Te avisamos por correo cuando se publique.' }
    if (property.partner_state === 'removed') return { error: 'Esta cabaña fue quitada. Escríbenos para volver a activarla.' }
    update = { partner_state: 'active', status: 'published' }
  } else {
    update = { partner_state: state, status: 'draft' }
  }

  const { error } = await service.from('properties').update({ ...update, updated_at: new Date().toISOString() }).eq('id', propertyId)
  if (error) return { error: `No se pudo cambiar: ${error.message}` }

  const label = state === 'paused' ? 'pausó' : state === 'removed' ? 'quitó de la plataforma' : 'reactivó'
  await notifyAdmin(`Un socio ${label} su cabaña: ${property.name}`, [
    `<strong>${escapeHtml(partner.name)}</strong> ${label} <strong>${escapeHtml(property.name as string)}</strong>.`,
  ])

  revalidatePath('/socios')
  revalidatePath('/')
  return { error: null }
}

// ---- Calendario ----------------------------------------------------------------
export async function partnerSetBlock(
  propertyId: string,
  dates: string[],
  blocked: boolean,
  note?: string | null
): Promise<{ error: string | null }> {
  const partner = await requirePartner()
  const property = await partnerProperty(partner.id, propertyId)
  if (!property) return { error: 'Esa cabaña no es tuya.' }

  const clean = [...new Set(dates.filter((d) => DATE_RE.test(d)))]
  if (clean.length === 0) return { error: 'No hay fechas seleccionadas.' }
  if (clean.length > 400) return { error: 'Demasiadas fechas a la vez.' }
  const service = createServiceClient()
  const who = `${partner.name} (socio)`

  if (blocked) {
    const { data: existing } = await service
      .from('blocked_dates')
      .select('date, source')
      .eq('property_id', propertyId)
      .in('date', clean)
    const taken = new Set((existing ?? []).filter((r) => r.source !== 'manual').map((r) => r.date))
    const rows = clean
      .filter((d) => !taken.has(d))
      .map((date) => ({ property_id: propertyId, date, source: 'manual' as const, note: note?.trim() || null, blocked_by: who }))
    if (rows.length === 0) return { error: 'Esas fechas ya están ocupadas por una reserva o por otra plataforma.' }
    const { error } = await service.from('blocked_dates').upsert(rows, { onConflict: 'property_id,date' })
    if (error) return { error: `No se pudo bloquear: ${error.message}` }
  } else {
    // Marca quién desbloquea para el historial del calendario.
    await service.from('blocked_dates').update({ blocked_by: who }).eq('property_id', propertyId).eq('source', 'manual').in('date', clean)
    const { error } = await service
      .from('blocked_dates')
      .delete()
      .eq('property_id', propertyId)
      .eq('source', 'manual')
      .in('date', clean)
    if (error) return { error: `No se pudo desbloquear: ${error.message}` }
  }

  revalidatePath(`/socios/cabana/${propertyId}/calendario`)
  revalidatePath('/admin/calendario')
  return { error: null }
}

// ---- iCal (Airbnb, Booking, otras) ------------------------------------------------
export async function partnerAddIcal(propertyId: string, _prev: Result, formData: FormData): Promise<Result> {
  const partner = await requirePartner()
  const property = await partnerProperty(partner.id, propertyId)
  if (!property) return { error: 'Esa cabaña no es tuya.' }
  const label = String(formData.get('label') || '').trim()
  const url = String(formData.get('url') || '').trim()
  if (!label) return { error: 'Ponle nombre al calendario (ej. Airbnb).' }
  if (!/^(https?|webcal):\/\//i.test(url)) return { error: 'Pega la liga completa del calendario (empieza con https://).' }

  const service = createServiceClient()
  const icalUrl = url.replace(/^webcal:\/\//i, 'https://')
  const { data: source, error } = await service
    .from('ical_sources')
    .insert({ property_id: propertyId, label, platform: guessPlatform(icalUrl), ical_url_import: icalUrl })
    .select('id')
    .single()
  if (error || !source) return { error: `No se pudo agregar: ${error?.message}` }

  const result = await syncOneIcalSource(service, source.id, propertyId, icalUrl)
  revalidatePath(`/socios/cabana/${propertyId}`)
  if (result.error) {
    return { error: `Se agregó, pero no se pudo leer todavía: ${result.error}. Revisa que la liga sea la de "exportar calendario".` }
  }
  return { error: null }
}

export async function partnerDeleteIcal(propertyId: string, sourceId: string) {
  const partner = await requirePartner()
  const property = await partnerProperty(partner.id, propertyId)
  if (!property) return
  const service = createServiceClient()
  await service.from('ical_sources').delete().eq('id', sourceId).eq('property_id', propertyId)
  // Los días que venían de ese calendario se liberan.
  await service.from('blocked_dates').delete().eq('property_id', propertyId).eq('ical_source_id', sourceId)
  revalidatePath(`/socios/cabana/${propertyId}`)
}

export async function currentPartnerOrNull() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? findPartnerByUserId(user.id) : null
}
