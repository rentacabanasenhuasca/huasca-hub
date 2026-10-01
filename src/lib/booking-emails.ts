// Envía los correos configurados por el host para una reserva recién
// confirmada. Se llama DESPUÉS de que finalizeBooking ya insertó el booking
// — lee todo lo que necesita directo de la base (booking + propiedad +
// host), así el checkout no tiene que ir cargando datos que ya están ahí.
//
// Nunca debe tronar una reserva: cada plantilla se manda en su propio
// try/catch y los errores solo se registran/regresan, nunca se lanzan.
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { LOGO_CID, LOGO_PNG_BASE64 } from '@/lib/email-logo'
import { EMAIL_PLACEHOLDERS } from '@/lib/email-placeholders'

// Se re-exporta desde aquí para no romper nada que ya importara
// EMAIL_PLACEHOLDERS de este archivo — pero el dato real vive en
// email-placeholders.ts (ver el comentario ahí del porqué).
export { EMAIL_PLACEHOLDERS }

// Paleta de marca de Huasca Retreats (la misma de src/app/globals.css) —
// se repite aquí porque el correo se manda como HTML con estilos en línea,
// que no puede leer las variables CSS del sitio.
const BRAND = {
  navyDeep: '#141c15',
  gold: '#c9a24a',
  goldLight: '#e4c777',
  burntOrange: '#c1622d',
  cream: '#f3ede0',
  stone: '#6b6459',
  ink: '#1f2a20',
}

// Envuelve el cuerpo (ya convertido a HTML) en la identidad visual de la
// marca: encabezado con el logo, tarjeta blanca para el contenido, franja
// dorada de acento y pie con los datos de contacto. El logo se manda como
// adjunto inline (cid) en vez de una URL remota, para que se vea siempre
// (Gmail y otros bloquean imágenes remotas por defecto, y el sitio aún no
// está en línea en huascaretreats.com).
function wrapBrandedEmail(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Huasca Retreats</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.cream};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.cream};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td align="center" style="background:${BRAND.navyDeep};padding:32px 24px;">
                <img src="cid:${LOGO_CID}" width="64" height="64" alt="Huasca Retreats" style="display:block;border-radius:50%;border:2px solid ${BRAND.gold};" />
                <div style="font-family:Georgia,'Times New Roman',serif;color:${BRAND.goldLight};font-size:13px;letter-spacing:3px;text-transform:uppercase;margin-top:14px;">
                  Huasca Retreats
                </div>
                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.cream};opacity:0.7;font-size:11px;letter-spacing:1px;margin-top:4px;">
                  Huasca de Ocampo, Hidalgo
                </div>
              </td>
            </tr>
            <tr>
              <td style="height:5px;background:linear-gradient(90deg,${BRAND.gold},${BRAND.burntOrange});line-height:5px;font-size:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:36px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.ink};font-size:15px;line-height:1.7;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td align="center" style="background:${BRAND.cream};padding:22px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.stone};font-size:12px;line-height:1.7;border-top:1px solid #e5ddc9;">
                <strong style="color:${BRAND.ink};">Huasca Retreats</strong><br />
                Huasca de Ocampo, Hidalgo, México<br />
                <a href="mailto:reservaciones@huascaretreats.com" style="color:${BRAND.stone};">reservaciones@huascaretreats.com</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function renderPlaceholders(text: string, data: Record<string, string>) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => data[key] ?? match)
}

// Para el asunto (texto plano, sin HTML).
function renderSubject(text: string, data: Record<string, string>) {
  return renderPlaceholders(text, data)
}

// Para el cuerpo: el host escribe texto plano en el panel, así que lo
// convertimos a párrafos con buen espaciado en vez de una sola línea con
// <br> — se ve mucho más cuidado dentro de la tarjeta de marca.
function renderBodyHtml(text: string, data: Record<string, string>) {
  const rendered = renderPlaceholders(text, data)
  return rendered
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 16px 0;">${paragraph.replace(/\n/g, '<br />')}</p>`)
    .join('')
}

export async function sendBookingEmails(
  supabase: SupabaseClient,
  bookingId: string,
  templateIds?: string[]
) {
  const { data: booking } = await supabase
    .from('bookings')
    .select(
      `id, guest_name, guest_email, guest_phone, guest_notes, check_in, check_out, adults, children, infants,
       pets, total_price_mxn, payment_provider,
       properties ( id, name, host_id, hosts ( name, email, phone ) )`
    )
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking) return { sent: 0, errors: ['No se encontró la reserva para mandar correos.'] }

  const property = Array.isArray(booking.properties) ? booking.properties[0] : booking.properties
  if (!property) return { sent: 0, errors: ['La reserva no tiene propiedad asociada.'] }
  const host = Array.isArray(property.hosts) ? property.hosts[0] : property.hosts

  const { data: bookingAddons } = await supabase
    .from('booking_addons')
    .select('name, unit_price_mxn, quantity, subtotal_mxn')
    .eq('booking_id', bookingId)

  const addonsText = (bookingAddons ?? []).length
    ? (bookingAddons ?? [])
        .map(
          (a) =>
            `- ${a.name}${a.quantity > 1 ? ` x${a.quantity}` : ''}: $${Number(a.subtotal_mxn).toLocaleString('es-MX')} MXN`
        )
        .join('\n')
    : 'Ninguno'

  const nights = Math.round(
    (new Date(`${booking.check_out}T00:00:00Z`).getTime() - new Date(`${booking.check_in}T00:00:00Z`).getTime()) /
      86400000
  )

  const providerLabel =
    booking.payment_provider === 'stripe'
      ? 'Tarjeta (Stripe)'
      : booking.payment_provider === 'mercadopago'
        ? 'Mercado Pago'
        : (booking.payment_provider ?? '')

  const data: Record<string, string> = {
    guest_name: booking.guest_name ?? '',
    guest_email: booking.guest_email ?? '',
    guest_phone: booking.guest_phone ?? '',
    guest_notes: booking.guest_notes ?? '',
    property_name: property.name ?? '',
    check_in: booking.check_in ?? '',
    check_out: booking.check_out ?? '',
    nights: String(nights),
    adults: String(booking.adults ?? 0),
    children: String(booking.children ?? 0),
    infants: String(booking.infants ?? 0),
    pets: booking.pets ? 'Sí' : 'No',
    total: `$${Number(booking.total_price_mxn ?? 0).toLocaleString('es-MX')} MXN`,
    payment_provider: providerLabel,
    booking_id: booking.id,
    host_name: host?.name ?? '',
    host_email: host?.email ?? '',
    host_phone: host?.phone ?? '',
    addons: addonsText,
  }

  // templateIds: si se manda, restringe el envío a solo esos correos (ej.
  // una reserva manual donde el host eligió a mano cuáles mandar) — si no
  // se manda, se comporta como siempre: todos los habilitados de la cabaña.
  let templatesQuery = supabase
    .from('email_templates')
    .select('id, recipient_type, recipient_emails, subject, body')
    .eq('property_id', property.id)
    .eq('trigger_event', 'booking_created')
    .eq('enabled', true)
  if (templateIds) templatesQuery = templatesQuery.in('id', templateIds)
  const { data: templates } = await templatesQuery

  const errors: string[] = []
  let sent = 0

  for (const template of templates ?? []) {
    let recipients: string[] = []
    if (template.recipient_type === 'guest') {
      recipients = data.guest_email ? [data.guest_email] : []
    } else if (template.recipient_type === 'admin') {
      recipients = data.host_email ? [data.host_email] : []
    } else {
      recipients = (template.recipient_emails ?? '')
        .split(',')
        .map((e: string) => e.trim())
        .filter(Boolean)
    }

    if (recipients.length === 0) {
      errors.push(`"${template.subject}" no se mandó: no hay ningún correo destinatario.`)
      continue
    }

    const result = await sendEmail({
      to: recipients,
      subject: renderSubject(template.subject, data),
      html: wrapBrandedEmail(renderBodyHtml(template.body, data)),
      attachments: [
        {
          filename: 'huasca-retreats.png',
          content: Buffer.from(LOGO_PNG_BASE64, 'base64'),
          cid: LOGO_CID,
          contentType: 'image/png',
        },
      ],
    })

    if (result.ok) sent += 1
    else errors.push(`"${template.subject}": ${result.error}`)
  }

  return { sent, errors }
}
