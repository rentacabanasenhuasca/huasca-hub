// Datos del huésped en bloqueos manuales ("reservas por fuera").
//
// Cuando un colaborador (ej. Angie, Alma), alguien de su equipo o un socio
// bloquea días porque los rentó por fuera (WhatsApp, efectivo, Airbnb sin
// calendario conectado…), puede anotar quién llega. Eso se guarda en
// manual_stays y cada día bloqueado apunta a su estancia (blocked_dates.stay_id).
//
// Ojo: blocked_dates es legible para el público en propiedades publicadas
// (el sitio la usa para la disponibilidad), por eso los datos del huésped
// NUNCA van en blocked_dates.note, sino en esta tabla, que solo lee el
// anfitrión (RLS) o el servidor con la service key.
//
// Quién ve cada estancia (owner_key):
//   - 'partner:<id>'  → la registró un socio o alguien de su equipo.
//   - 'staff:<id>'    → la registró un colaborador o alguien de SU equipo
//                       (el id es el del colaborador "jefe").
// Un colaborador solo ve las estancias de su propio grupo (así Angie no ve
// las de Alma aunque compartieran cabaña), salvo que el anfitrión le haya
// dado permiso de "Ver reservas". El anfitrión ve todas en su calendario.
import type { SupabaseClient } from '@supabase/supabase-js'

export type GuestInput = {
  guest_name: string
  guest_phone?: string | null
  guests?: number | null
  amount_mxn?: number | null
  // Lo que el huésped ya pagó y lo que todavía debe (lo anota el equipo).
  paid_mxn?: number | null
  balance_mxn?: number | null
  channel?: string | null
  notes?: string | null
}

export type ManualStay = {
  id: string
  property_id: string
  check_in: string
  check_out: string
  guest_name: string
  guest_phone: string | null
  guests: number | null
  amount_mxn: number | null
  paid_mxn: number | null
  balance_mxn: number | null
  channel: string | null
  notes: string | null
  owner_key: string
  created_by: string
  created_at: string
}

export const STAY_COLUMNS =
  'id, property_id, check_in, check_out, guest_name, guest_phone, guests, amount_mxn, paid_mxn, balance_mxn, channel, notes, owner_key, created_by, created_at'

export const STAY_CHANNELS = ['WhatsApp / directo', 'Airbnb', 'Booking', 'Recomendación', 'Otro']

/** Limpia lo que manda el formulario; null si no hay nombre (= bloqueo sin huésped). */
export function cleanGuest(guest: GuestInput | null | undefined): GuestInput | null {
  if (!guest) return null
  const name = String(guest.guest_name ?? '').trim().slice(0, 120)
  if (!name) return null
  const phone = String(guest.guest_phone ?? '').replace(/[^\d+]/g, '').slice(0, 20) || null
  const guests = Number(guest.guests)
  const amount = Number(guest.amount_mxn)
  const paid = Number(guest.paid_mxn)
  const balance = Number(guest.balance_mxn)
  return {
    guest_name: name,
    guest_phone: phone,
    guests: Number.isFinite(guests) && guests > 0 ? Math.min(Math.round(guests), 99) : null,
    amount_mxn: Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null,
    paid_mxn: guest.paid_mxn !== null && guest.paid_mxn !== undefined && Number.isFinite(paid) && paid >= 0 ? Math.round(paid) : null,
    balance_mxn: guest.balance_mxn !== null && guest.balance_mxn !== undefined && Number.isFinite(balance) && balance >= 0 ? Math.round(balance) : null,
    channel: String(guest.channel ?? '').trim().slice(0, 40) || null,
    notes: String(guest.notes ?? '').trim().slice(0, 500) || null,
  }
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Crea la estancia para las noches indicadas y regresa su id. */
export async function createStay(
  service: SupabaseClient,
  args: {
    propertyId: string
    dates: string[]
    guest: GuestInput
    createdBy: string
    ownerKey: string
    staffId?: string | null
    partnerId?: string | null
  }
): Promise<{ id: string | null; error: string | null }> {
  const sorted = [...args.dates].sort()
  const { data, error } = await service
    .from('manual_stays')
    .insert({
      property_id: args.propertyId,
      check_in: sorted[0],
      check_out: addDays(sorted[sorted.length - 1], 1),
      ...args.guest,
      owner_key: args.ownerKey,
      created_by: args.createdBy,
      created_by_staff_id: args.staffId ?? null,
      created_by_partner_id: args.partnerId ?? null,
    })
    .select('id')
    .single()
  if (error || !data) return { id: null, error: error?.message ?? 'sin respuesta' }
  return { id: data.id as string, error: null }
}

export function mxn(n: number) {
  return `$${Math.round(n).toLocaleString('es-MX')}`
}

function shortDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** "Ya pagó $X · Debe $Y" (o "Pagado completo"); null si no se anotó nada. */
export function paymentText(stay: Pick<ManualStay, 'paid_mxn' | 'balance_mxn'>) {
  const paid = stay.paid_mxn
  const balance = stay.balance_mxn
  if (paid == null && balance == null) return null
  if (balance === 0) return `Pago: pagado completo${paid ? ` (${mxn(paid)})` : ''}`
  const parts = []
  if (paid != null) parts.push(`ya pagó ${mxn(paid)}`)
  if (balance != null) parts.push(`debe ${mxn(balance)}`)
  return `Pago: ${parts.join(' · ')}`
}

/** Renglones legibles para el panel de información de un día. */
export function stayLines(stay: Pick<ManualStay, 'check_in' | 'check_out' | 'guest_name' | 'guest_phone' | 'guests' | 'amount_mxn' | 'paid_mxn' | 'balance_mxn' | 'channel' | 'notes' | 'created_by' | 'created_at'>) {
  const nights = Math.round((Date.parse(stay.check_out) - Date.parse(stay.check_in)) / 86_400_000)
  const lines = [
    `Huésped: ${stay.guest_name}${stay.guests ? ` · ${stay.guests} persona(s)` : ''}`,
    `Estancia: ${shortDate(stay.check_in)} → ${shortDate(stay.check_out)} (${nights} noche${nights === 1 ? '' : 's'})`,
  ]
  if (stay.guest_phone) lines.push(`WhatsApp: ${stay.guest_phone}`)
  const pay = paymentText(stay)
  if (pay) lines.push(pay)
  if (stay.channel) lines.push(`Canal: ${stay.channel}`)
  if (stay.notes) lines.push(`Notas: ${stay.notes}`)
  lines.push(
    `Lo agregó ${stay.created_by} el ${new Date(stay.created_at).toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
      dateStyle: 'medium',
      timeStyle: 'short',
    })}`
  )
  return lines
}

/** Liga de WhatsApp para un teléfono mexicano (10 dígitos → +52). */
export function waLink(phone: string) {
  const digits = phone.replace(/\D/g, '')
  const full = digits.length === 10 ? `52${digits}` : digits
  return `https://wa.me/${full}`
}
