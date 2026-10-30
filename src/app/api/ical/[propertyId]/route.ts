// Exporta las fechas ocupadas de una propiedad como .ics, para pegarlo en
// Airbnb/Booking/etc. y que no se empalmen reservas. Usa el UUID de la
// propiedad como "token" — no es adivinable, así que no hace falta login
// para que Airbnb pueda leerlo.
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// Siempre se genera al momento: Airbnb/Booking deben ver los bloqueos y
// reservas nuevas en cuanto vuelven a leer el calendario, sin caché de por medio.
export const dynamic = 'force-dynamic'

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
  //
  // Además, si el anfitrión abrió algunas noches de una reserva a la fuerza
  // (overbooking, desde el calendario del panel), solo se exportan las noches
  // que la reserva todavía ocupa — no todo su check-in → check-out.
  const bookingIds = (bookingsRaw ?? []).map((b) => b.id)
  const nightsByBooking = new Map<string, string[]>()
  if (bookingIds.length > 0) {
    const { data: blocked } = await supabase
      .from('blocked_dates')
      .select('booking_id, date')
      .eq('property_id', propertyId)
      .in('booking_id', bookingIds)
      .order('date')
    for (const row of blocked ?? []) {
      if (!row.booking_id) continue
      const list = nightsByBooking.get(row.booking_id) ?? []
      list.push(row.date)
      nightsByBooking.set(row.booking_id, list)
    }
  }
  const nextNight = (d: string) => {
    const x = new Date(`${d}T00:00:00Z`)
    x.setUTCDate(x.getUTCDate() + 1)
    return x.toISOString().slice(0, 10)
  }
  // Tramos continuos de noches ocupadas por cada reserva.
  const bookings: { id: string; check_in: string; check_out: string }[] = []
  for (const b of bookingsRaw ?? []) {
    const nights = nightsByBooking.get(b.id)
    if (!nights || nights.length === 0) continue
    let start = nights[0]
    let end = nextNight(nights[0])
    for (const n of nights.slice(1)) {
      if (n === end) {
        end = nextNight(n)
      } else {
        bookings.push({ id: start === b.check_in ? b.id : `${b.id}-${start}`, check_in: start, check_out: end })
        start = n
        end = nextNight(n)
      }
    }
    bookings.push({ id: start === b.check_in ? b.id : `${b.id}-${start}`, check_in: start, check_out: end })
  }

  // DTSTAMP es obligatorio en cada evento según el estándar iCal; sin él
  // algunas plataformas tratan el calendario como inválido o sin cambios.
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

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
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${toIcsDate(b.check_in)}`,
      `DTEND;VALUE=DATE:${toIcsDate(b.check_out)}`,
      `SUMMARY:Reservado — ${property.name}`,
      'END:VEVENT'
    )
  }

  // Bloqueos manuales del panel (fechas cerradas a mano, p. ej. una reserva
  // por WhatsApp o una cabaña en mantenimiento): también deben cerrarse en
  // Airbnb/Booking. Solo se exportan los de origen "manual" — los que vienen
  // de importar el iCal de otra plataforma NO se reenvían, para no crear un
  // ciclo de bloqueos entre plataformas.
  const today = new Date().toISOString().slice(0, 10)
  const { data: manual } = await supabase
    .from('blocked_dates')
    .select('date')
    .eq('property_id', propertyId)
    .eq('source', 'manual')
    .gte('date', today)
    .order('date')
  const nextDay = (d: string) => {
    const x = new Date(`${d}T00:00:00Z`)
    x.setUTCDate(x.getUTCDate() + 1)
    return x.toISOString().slice(0, 10)
  }
  let rangeStart: string | null = null
  let rangeEnd: string | null = null // exclusivo (día siguiente al último bloqueado)
  const flush = () => {
    if (!rangeStart || !rangeEnd) return
    lines.push(
      'BEGIN:VEVENT',
      `UID:manual-${rangeStart}-${propertyId}@huasca-hub`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${toIcsDate(rangeStart)}`,
      `DTEND;VALUE=DATE:${toIcsDate(rangeEnd)}`,
      `SUMMARY:No disponible — ${property.name}`,
      'END:VEVENT'
    )
  }
  for (const row of manual ?? []) {
    if (rangeEnd === row.date) {
      rangeEnd = nextDay(row.date)
    } else {
      flush()
      rangeStart = row.date
      rangeEnd = nextDay(row.date)
    }
  }
  flush()

  lines.push('END:VCALENDAR')

  return new NextResponse(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${propertyId}.ics"`,
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  })
}
