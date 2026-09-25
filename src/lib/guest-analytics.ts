// Lógica compartida para armar la base de huéspedes + analítica general —
// la usan tanto la página /admin/huespedes (para mostrarla en pantalla)
// como las rutas de exportación (para bajarla en CSV), así los dos lados
// calculan exactamente lo mismo.
import type { SupabaseClient } from '@supabase/supabase-js'

export type BookingRow = {
  id: string
  guest_name: string
  guest_email: string | null
  guest_phone: string | null
  check_in: string
  check_out: string
  status: string
  total_price_mxn: number
  source: string
  created_at: string
  property_id: string
  properties: { name: string } | { name: string }[] | null
}

export type GuestSummary = {
  key: string
  name: string
  email: string | null
  phone: string | null
  bookingsCount: number
  totalSpentMxn: number
  properties: Set<string>
  firstStay: string
  lastStay: string
  cancelledCount: number
}

export type PropertyRevenue = { name: string; bookings: number; revenue: number }

export type GuestAnalytics = {
  rows: BookingRow[]
  guests: GuestSummary[]
  topProperties: PropertyRevenue[]
  bySource: Map<string, number>
  totalRevenue: number
  totalBookings: number
  repeatGuests: number
  avgSpendPerGuest: number
}

export function propertyNameOf(b: BookingRow): string {
  const p = Array.isArray(b.properties) ? b.properties[0] : b.properties
  return p?.name ?? '—'
}

// Agrupa reservas por huésped. El correo es la llave más confiable (una
// persona puede reservar varias veces); si no dejó correo, cae a
// teléfono, y si tampoco hay teléfono, al nombre tal cual (mejor esfuerzo).
function guestKeyOf(b: BookingRow): string {
  if (b.guest_email) return `email:${b.guest_email.trim().toLowerCase()}`
  if (b.guest_phone) return `phone:${b.guest_phone.replace(/\D/g, '')}`
  return `name:${b.guest_name.trim().toLowerCase()}`
}

export async function getGuestAnalytics(supabase: SupabaseClient, hostId: string): Promise<GuestAnalytics> {
  const { data: properties } = await supabase.from('properties').select('id').eq('host_id', hostId)
  const propertyIds = (properties ?? []).map((p) => p.id)

  const { data: bookings } =
    propertyIds.length > 0
      ? await supabase
          .from('bookings')
          .select(
            'id, guest_name, guest_email, guest_phone, check_in, check_out, status, total_price_mxn, source, created_at, property_id, properties(name)'
          )
          .in('property_id', propertyIds)
          .order('check_in', { ascending: false })
      : { data: [] as BookingRow[] }

  const rows = (bookings ?? []) as unknown as BookingRow[]

  const confirmedRows = rows.filter((b) => b.status !== 'cancelled' && b.status !== 'payment_failed')
  const totalRevenue = confirmedRows.reduce((sum, b) => sum + Number(b.total_price_mxn), 0)
  const totalBookings = confirmedRows.length

  const byProperty = new Map<string, PropertyRevenue>()
  for (const b of confirmedRows) {
    const name = propertyNameOf(b)
    const entry = byProperty.get(b.property_id) ?? { name, bookings: 0, revenue: 0 }
    entry.bookings += 1
    entry.revenue += Number(b.total_price_mxn)
    byProperty.set(b.property_id, entry)
  }
  const topProperties = [...byProperty.values()].sort((a, b) => b.revenue - a.revenue)

  const bySource = new Map<string, number>()
  for (const b of confirmedRows) {
    bySource.set(b.source, (bySource.get(b.source) ?? 0) + 1)
  }

  const guestMap = new Map<string, GuestSummary>()
  for (const b of rows) {
    const key = guestKeyOf(b)
    const existing = guestMap.get(key)
    const isCancelled = b.status === 'cancelled' || b.status === 'payment_failed'
    if (existing) {
      existing.bookingsCount += isCancelled ? 0 : 1
      existing.cancelledCount += isCancelled ? 1 : 0
      existing.totalSpentMxn += isCancelled ? 0 : Number(b.total_price_mxn)
      existing.properties.add(propertyNameOf(b))
      if (b.check_in > existing.lastStay) existing.lastStay = b.check_in
      if (b.check_in < existing.firstStay) existing.firstStay = b.check_in
      if (!existing.email && b.guest_email) existing.email = b.guest_email
      if (!existing.phone && b.guest_phone) existing.phone = b.guest_phone
    } else {
      guestMap.set(key, {
        key,
        name: b.guest_name,
        email: b.guest_email,
        phone: b.guest_phone,
        bookingsCount: isCancelled ? 0 : 1,
        cancelledCount: isCancelled ? 1 : 0,
        totalSpentMxn: isCancelled ? 0 : Number(b.total_price_mxn),
        properties: new Set([propertyNameOf(b)]),
        firstStay: b.check_in,
        lastStay: b.check_in,
      })
    }
  }
  const guests = [...guestMap.values()].sort((a, b) => b.totalSpentMxn - a.totalSpentMxn)
  const repeatGuests = guests.filter((g) => g.bookingsCount > 1).length
  const avgSpendPerGuest = guests.length > 0 ? totalRevenue / guests.length : 0

  return { rows, guests, topProperties, bySource, totalRevenue, totalBookings, repeatGuests, avgSpendPerGuest }
}

// Convierte filas a un bloque CSV bien formado (comillas donde hace falta).
// Sin BOM — para un archivo con un solo bloque usa toCsv(); para pegar
// varios bloques en un mismo archivo (secciones separadas), usa esta y
// añade el BOM una sola vez al armar el archivo completo.
export function csvBlock(headers: string[], rows: (string | number)[][]): string {
  const escape = (v: string | number) => {
    const s = String(v ?? '')
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))]
  return lines.join('\r\n')
}

// Convierte filas a un CSV completo listo para descargar (un solo bloque).
// Antepone un BOM UTF-8 para que Excel en Mac/Windows muestre bien los
// acentos y "ñ" en vez de caracteres raros.
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  return '﻿' + csvBlock(headers, rows)
}
