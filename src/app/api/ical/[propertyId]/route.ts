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

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, check_in, check_out, guest_name')
    .eq('property_id', propertyId)
    .eq('status', 'confirmed')

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
