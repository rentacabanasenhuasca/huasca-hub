import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireHost } from '@/lib/hosts'
import { getGuestAnalytics, propertyNameOf, toCsv } from '@/lib/guest-analytics'

// Exporta cada reserva individual (no agrupada por huésped) — la "base de
// datos" completa, para quien quiera ver o cruzar el detalle de cada
// transacción en Excel.
export async function GET() {
  const host = await requireHost()
  const supabase = await createClient()
  const { rows } = await getGuestAnalytics(supabase, host.id)

  const statusLabel = (s: string) =>
    s === 'confirmed' ? 'Confirmada' : s === 'cancelled' ? 'Cancelada' : s === 'payment_failed' ? 'Pago fallido' : s
  const sourceLabel = (s: string) => (s === 'direct' ? 'Directo (este sitio)' : s)

  const csv = toCsv(
    [
      'ID de reserva',
      'Cabaña',
      'Huésped',
      'Correo',
      'Teléfono',
      'Llegada',
      'Salida',
      'Estatus',
      'Total (MXN)',
      'Origen',
      'Creada el',
    ],
    rows.map((b) => [
      b.id,
      propertyNameOf(b),
      b.guest_name,
      b.guest_email ?? '',
      b.guest_phone ?? '',
      b.check_in,
      b.check_out,
      statusLabel(b.status),
      b.total_price_mxn,
      sourceLabel(b.source),
      b.created_at,
    ])
  )

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="reservas-huasca-retreats-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
