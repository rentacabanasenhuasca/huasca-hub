import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireHost } from '@/lib/hosts'
import { getGuestAnalytics, toCsv } from '@/lib/guest-analytics'

export async function GET() {
  const host = await requireHost()
  const supabase = await createClient()
  const { guests } = await getGuestAnalytics(supabase, host.id)

  const csv = toCsv(
    ['Nombre', 'Correo', 'Teléfono', 'Cabañas', 'Reservas', 'Canceladas', 'Total gastado (MXN)', 'Primera estancia', 'Última estancia'],
    guests.map((g) => [
      g.name,
      g.email ?? '',
      g.phone ?? '',
      [...g.properties].join(' / '),
      g.bookingsCount,
      g.cancelledCount,
      g.totalSpentMxn,
      g.firstStay,
      g.lastStay,
    ])
  )

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="huespedes-huasca-retreats-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
