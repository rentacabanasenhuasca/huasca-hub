// Parser mínimo de iCal (.ics) — solo lo que necesitamos: leer los VEVENT de
// un calendario externo (Airbnb, Booking, etc.) para saber qué fechas
// bloquear. No es un parser completo de RFC 5545 a propósito, para no
// depender de una librería externa (así no hay que pedirte otro
// `npm install`). Soporta eventos de un día completo (DTSTART/DTEND con
// VALUE=DATE, formato YYYYMMDD) y eventos con hora (toma solo la fecha).

export type IcalEvent = {
  /** YYYY-MM-DD, inclusive */
  start: string
  /** YYYY-MM-DD, EXCLUSIVE (convención estándar de iCal para eventos de día completo) */
  end: string
  /** Texto del propio evento (SUMMARY, o DESCRIPTION si SUMMARY no trae nada
   *  útil) — casi nunca incluye el nombre del huésped (las plataformas no lo
   *  comparten por esta vía), pero a veces trae un código de confirmación. */
  summary: string | null
}

function unfoldLines(text: string): string[] {
  // RFC 5545: una línea que empieza con espacio o tab es continuación de la
  // anterior (line folding). Primero unimos esas, luego separamos por línea.
  const normalized = text.replace(/\r\n/g, '\n')
  const joined = normalized.replace(/\n[ \t]/g, '')
  return joined.split('\n')
}

function toIsoDate(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
}

// RFC 5545: \, \; \\ y \n van escapados dentro de un valor de texto.
function unescapeText(raw: string): string {
  return raw.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim()
}

export function parseIcalEvents(icsText: string): IcalEvent[] {
  const lines = unfoldLines(icsText)
  const events: IcalEvent[] = []

  let inEvent = false
  let start: string | null = null
  let end: string | null = null
  let summary: string | null = null
  let description: string | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      start = null
      end = null
      summary = null
      description = null
      continue
    }
    if (line === 'END:VEVENT') {
      if (inEvent && start) {
        // SUMMARY suele ser lo más corto y útil ("Reserved", a veces con un
        // código); si viene vacío probamos con DESCRIPTION.
        events.push({ start, end: end ?? start, summary: summary || description || null })
      }
      inEvent = false
      continue
    }
    if (!inEvent) continue

    // Cubre "DTSTART:20260924", "DTSTART;VALUE=DATE:20260924" y
    // "DTSTART;TZID=...:20260924T150000Z" — siempre nos quedamos con los
    // primeros 8 dígitos (la fecha) después de los dos puntos.
    const dtstart = line.match(/^DTSTART(?:;[^:]*)?:(\d{8})/)
    if (dtstart) {
      start = toIsoDate(dtstart[1])
      continue
    }
    const dtend = line.match(/^DTEND(?:;[^:]*)?:(\d{8})/)
    if (dtend) {
      end = toIsoDate(dtend[1])
      continue
    }
    const summaryMatch = line.match(/^SUMMARY(?:;[^:]*)?:(.*)$/)
    if (summaryMatch) {
      summary = unescapeText(summaryMatch[1])
      continue
    }
    const descriptionMatch = line.match(/^DESCRIPTION(?:;[^:]*)?:(.*)$/)
    if (descriptionMatch) {
      description = unescapeText(descriptionMatch[1])
      continue
    }
  }

  return events
}

/** Expande un evento a la lista de fechas (YYYY-MM-DD) que cubre, usando la
 * convención de iCal de que DTEND es exclusivo. */
export function expandEventDates(event: IcalEvent): string[] {
  const dates: string[] = []
  const cur = new Date(`${event.start}T00:00:00Z`)
  const end = new Date(`${event.end}T00:00:00Z`)

  if (end <= cur) {
    dates.push(event.start)
    return dates
  }

  while (cur < end) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return dates
}

/** Detecta la plataforma a partir de la URL, para el ícono/color — el
 * nombre visible lo pone el usuario aparte (label). */
export function guessPlatform(url: string): 'airbnb' | 'booking' | 'otro' {
  const lower = url.toLowerCase()
  if (lower.includes('airbnb')) return 'airbnb'
  if (lower.includes('booking.com')) return 'booking'
  return 'otro'
}
