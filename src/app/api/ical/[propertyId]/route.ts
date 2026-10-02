// Exporta las fechas ocupadas de una propiedad como .ics, para pegarlo en
// Airbnb/Booking/etc. y que no se empalmen reservas. Usa el UUID de la
// propiedad como "token" — no es adivinable, así que no hace falta login
// para que Airbnb pueda leerlo.
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

function toIcsDate(dateStr: string) {
  return dateStr.replace(/-/g, '')
}

export async function GET(_request: Request, { params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params
  const supabase = createServiceClient()

  const { data: property } = await supabase
    .from('properties')
    .select('id, name')
    .eq('id', propertyId)
    .maybeSingle()

  if (!property) {
    return new NextResponse('Not found', { status: 404 })
  }

  const { data: bookingsRaw } = await supabase
    .from('bookings')
    .select('id, check_in, check_out, guest_name')
    .eq('property_id', propertyId)
    .eq('status', 'confirmed')

  // Red de seguridad: una reserva "confirmed" sin NINGÚN blocked_dates propio
  // es una reserva huérfana/fantasma (normalmente por un bug al mover o
  // cancelar una reserva a medias). No la mandamos a Airbnb/Booking aunque
  // siga "confirmed" en la base — así, aunque algo más vuelva a dejar una
  // reserva huérfana en el futuro, nunca se le avisa a una plataforma externa
  // de una fecha ocupada que ya no existe en nuestro propio calendario.
  const bookingIds = (bookingsRaw ?? []).map((b) => b.id)
  const blockedBookingIds = new Set<string>()
  if (bookingIds.length > 0) {
    const { data: blocked } = await supabase
      .from('blocked_dates')
      .select('booking_id')
      .eq('property_id', propertyId)
      .in('booking_id', bookingIds)
    for (const row of blocked ?? []) {
      if (row.booking_id) blockedBookingIds.add(row.booking_id)
    }
  }
  const bookings = (bookingsRaw ?? []).filter((b) => blockedBookingIds.has(b.id))

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Huasca Hub//ES',
    'CALSCALE:GREGORIAN',
  ]

  for (const b of bookings ?? []) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${b.id}@huasca-hub`,
      `DTSTART;VALUE=DATE:${toIcsDate(b.check_in)}`,
      `DTEND;VALUE=DATE:${toIcsDate(b.check_out)}`,
      `SUMMARY:Reservado — ${property.name}`,
      'END:VEVENT'
    )
  }

  lines.push('END:VCALENDAR')

  return new NextResponse(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${propertyId}.ics"`,
      'Cache-Control': 'public, max-age=1800',
    },
  })
}
