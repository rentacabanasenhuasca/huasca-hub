'use server'

// Bloqueos hechos por colaboradores desde /equipo. Solo tocan bloqueos
// manuales (source='manual'): nunca pisan una reserva ni un bloqueo que
// venga de Airbnb/iCal. Los bloqueos manuales salen en el iCal que lee
// Airbnb, así que se sincronizan solos.
import { revalidatePath } from 'next/cache'
import { requireStaff, staffOwnerKey } from '@/lib/staff'
import { createServiceClient } from '@/lib/supabase/service'
import { cleanGuest, createStay, type GuestInput } from '@/lib/manual-stays'
import { loadStay, moveStay, updateStayPayment } from '@/lib/manual-stays-ops'
import { guessPlatform } from '@/lib/ical'
import { syncOneIcalSource } from '@/lib/ical-sync'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function staffSetBlock(
  propertyId: string,
  dates: string[],
  blocked: boolean,
  note?: string | null,
  guestInput?: GuestInput | null
): Promise<{ error: string | null }> {
  const staff = await requireStaff()
  if (!staff.can_block_dates) return { error: 'No tienes permiso para bloquear fechas.' }
  if (!staff.properties.some((p) => p.id === propertyId)) return { error: 'No tienes acceso a esa propiedad.' }

  const clean = [...new Set(dates.filter((d) => DATE_RE.test(d)))]
  if (clean.length === 0) return { error: 'No hay fechas seleccionadas.' }
  if (clean.length > 400) return { error: 'Demasiadas fechas a la vez.' }

  const service = createServiceClient()

  if (blocked) {
    const { data: existing } = await service
      .from('blocked_dates')
      .select('date, source')
      .eq('property_id', propertyId)
      .in('date', clean)
    const taken = new Set((existing ?? []).filter((r) => r.source !== 'manual').map((r) => r.date))
    const text = note?.trim() || null
    const free = clean.filter((d) => !taken.has(d))
    if (free.length === 0) return { error: 'Esas fechas ya están ocupadas por una reserva o por otra plataforma.' }

    // Si es una reserva por fuera, primero se guarda quién llega.
    const guest = cleanGuest(guestInput)
    let stayId: string | null = null
    if (guest) {
      const stay = await createStay(service, {
        propertyId,
        dates: free,
        guest,
        createdBy: staff.name,
        ownerKey: staffOwnerKey(staff),
        staffId: staff.id,
      })
      if (stay.error) return { error: `No se pudieron guardar los datos del huésped: ${stay.error}` }
      stayId = stay.id
    }

    const rows = free.map((date) => ({
      property_id: propertyId,
      date,
      source: 'manual' as const,
      note: text,
      blocked_by: staff.name,
      stay_id: stayId,
    }))
    const { error } = await service.from('blocked_dates').upsert(rows, { onConflict: 'property_id,date' })
    if (error) {
      if (stayId) await service.from('manual_stays').delete().eq('id', stayId)
      return { error: `No se pudo bloquear: ${error.message}` }
    }
  } else {
    // Marca quién desbloquea justo antes de borrar, para que el historial
    // del calendario (trigger en la base) registre a este colaborador.
    await service
      .from('blocked_dates')
      .update({ blocked_by: staff.name })
      .eq('property_id', propertyId)
      .eq('source', 'manual')
      .in('date', clean)
    const { error } = await service
      .from('blocked_dates')
      .delete()
      .eq('property_id', propertyId)
      .eq('source', 'manual')
      .in('date', clean)
    if (error) return { error: `No se pudo desbloquear: ${error.message}` }
  }

  revalidatePath('/equipo')
  revalidatePath('/admin/calendario')
  return { error: null }
}

// ---- iCal (Airbnb, Booking, otras) ------------------------------------------
// Mismo flujo que el panel de socios: el colaborador pega la liga de
// "exportar calendario" de la otra plataforma y esas fechas se bloquean solas.
type Result = { error: string | null }

async function staffWithProperty(propertyId: string) {
  const staff = await requireStaff()
  if (!staff.can_block_dates) return null
  if (!staff.properties.some((p) => p.id === propertyId)) return null
  return staff
}

export async function staffAddIcal(propertyId: string, _prev: Result, formData: FormData): Promise<Result> {
  const staff = await staffWithProperty(propertyId)
  if (!staff) return { error: 'No tienes permiso para conectar calendarios de esta cabaña.' }
  const label = String(formData.get('label') || '').trim()
  const url = String(formData.get('url') || '').trim()
  if (!label) return { error: 'Ponle nombre al calendario (ej. Airbnb).' }
  if (!/^(https?|webcal):\/\//i.test(url)) return { error: 'Pega la liga completa del calendario (empieza con https://).' }

  const service = createServiceClient()
  const icalUrl = url.replace(/^webcal:\/\//i, 'https://')
  const { data: source, error } = await service
    .from('ical_sources')
    .insert({
      property_id: propertyId,
      label,
      platform: guessPlatform(icalUrl),
      ical_url_import: icalUrl,
      added_by_staff_id: staff.id,
    })
    .select('id')
    .single()
  if (error || !source) return { error: `No se pudo agregar: ${error?.message}` }

  const result = await syncOneIcalSource(service, source.id, propertyId, icalUrl)
  revalidatePath('/equipo')
  revalidatePath('/admin/calendario')
  if (result.error) {
    return { error: `Se agregó, pero no se pudo leer todavía: ${result.error}. Revisa que la liga sea la de "exportar calendario".` }
  }
  return { error: null }
}

export async function staffDeleteIcal(propertyId: string, sourceId: string) {
  const staff = await staffWithProperty(propertyId)
  if (!staff) return
  const service = createServiceClient()
  // Solo puede quitar los calendarios que él mismo conectó (no los que puso
  // el anfitrión, como el de Airbnb de la cabaña).
  const { data: deleted } = await service
    .from('ical_sources')
    .delete()
    .eq('id', sourceId)
    .eq('property_id', propertyId)
    .eq('added_by_staff_id', staff.id)
    .select('id')
  if (!deleted?.length) return
  await service.from('blocked_dates').delete().eq('property_id', propertyId).eq('ical_source_id', sourceId)
  revalidatePath('/equipo')
  revalidatePath('/admin/calendario')
}

// ---- Reservas por fuera: pago y cambio de cabaña ------------------------------
async function staffStay(stayId: string) {
  const staff = await requireStaff()
  if (!staff.can_block_dates) return null
  const service = createServiceClient()
  const stay = await loadStay(service, stayId)
  if (!stay || !staff.properties.some((p) => p.id === stay.property_id)) return null
  if (!staff.can_view_bookings && stay.owner_key !== staffOwnerKey(staff)) return null
  return { staff, service, stay }
}

export async function staffUpdateStayPayment(stayId: string, paid: number | null, balance: number | null): Promise<Result> {
  const ctx = await staffStay(stayId)
  if (!ctx) return { error: 'No puedes cambiar esa reserva.' }
  const r = await updateStayPayment(ctx.service, stayId, paid, balance)
  revalidatePath('/equipo')
  revalidatePath('/admin/calendario')
  return r
}

export async function staffMoveStay(stayId: string, targetPropertyId: string): Promise<Result> {
  const ctx = await staffStay(stayId)
  if (!ctx) return { error: 'No puedes mover esa reserva.' }
  if (!ctx.staff.properties.some((p) => p.id === targetPropertyId)) return { error: 'No tienes acceso a esa cabaña.' }
  const r = await moveStay(ctx.service, stayId, targetPropertyId, ctx.staff.name)
  revalidatePath('/equipo')
  revalidatePath('/admin/calendario')
  return r
}
