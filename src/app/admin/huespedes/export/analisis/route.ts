import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireHost } from '@/lib/hosts'
import { getGuestAnalytics, csvBlock } from '@/lib/guest-analytics'

export async function GET() {
  const host = await requireHost()
  const supabase = await createClient()
  const { topProperties, bySource, totalRevenue, totalBookings, guests, repeatGuests, avgSpendPerGuest } =
    await getGuestAnalytics(supabase, host.id)

  const sourceLabel = (s: string) => (s === 'direct' ? 'Directo (este sitio)' : s)

  // Un solo CSV con varios bloques (KPIs, ingresos por cabaña, fuentes) —
  // Excel/Sheets lo abre perfecto como una sola hoja con secciones. El BOM
  // (para que Excel muestre bien acentos/ñ) va una sola vez, al inicio.
  const blocks: string[] = []
  blocks.push(
    csvBlock(
      ['Resumen general', ''],
      [
        ['Ingresos totales (MXN)', totalRevenue],
        ['Reservas confirmadas', totalBookings],
        ['Huéspedes únicos', guests.length],
        ['Huéspedes recurrentes', repeatGuests],
        ['Gasto promedio por huésped (MXN)', Math.round(avgSpendPerGuest)],
      ]
    )
  )
  blocks.push(
    csvBlock(
      ['Ingresos por cabaña', 'Reservas', 'Ingresos (MXN)'],
      topProperties.map((p) => [p.name, p.bookings, p.revenue])
    )
  )
  blocks.push(
    csvBlock(
      ['Origen de la reserva', 'Reservas'],
      [...bySource.entries()].map(([source, count]) => [sourceLabel(source), count])
    )
  )

  const csv = '﻿' + blocks.join('\r\n\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="analisis-huasca-retreats-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
