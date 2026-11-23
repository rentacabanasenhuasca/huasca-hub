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
import { whatsappDigits } from '@/lib/sale-listings'

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
export function wrapBrandedEmail(bodyHtml: string): string {
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

// Botón verde de WhatsApp para escribirle al huésped (abre el chat con su
// número y un saludo listo). Vacío si la reserva no trae teléfono.
function waButton(phone: string | null | undefined, text: string, label: string) {
  const digits = whatsappDigits(phone)
  if (!digits) return ''
  const href = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
  return (
    `<a href="${href}" target="_blank" rel="noopener" ` +
    `style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;font-weight:600;` +
    `padding:12px 22px;border-radius:999px;font-size:15px;">💬 ${label}</a>`
  )
}

function whatsappButtonHtml(phone: string, guestName: string, propertyName: string, checkIn: string) {
  const firstName = guestName.trim().split(/\s+/)[0] ?? ''
  return waButton(
    phone,
    `Hola ${firstName}, te escribimos de Huasca Retreats sobre tu reserva en ${propertyName} (llegada ${checkIn}).`,
    'Escribir por WhatsApp al huésped'
  )
}

// El correo del administrador siempre lleva el botón de WhatsApp al final
// (en todas las cabañas, también las que se creen después), a menos que la
// plantilla ya lo coloque en otro lugar con {{guest_whatsapp_button}}.
function withWhatsappButton(template: { recipient_type: string; body: string }, button: string) {
  if (template.recipient_type !== 'admin' || !button) return template.body
  if (/\{\{\s*guest_whatsapp_button\s*\}\}/.test(template.body)) return template.body
  return `${template.body.trimEnd()}\n\n{{guest_whatsapp_button}}`
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
  templateIds?: string[],
  // Si se manda, todos los correos van solo a estas direcciones (reenvío a
  // alguien en particular) en vez de a su destinatario configurado.
  overrideTo?: string[]
) {
  const { data: booking } = await supabase
    .from('bookings')
    .select(
      `id, guest_name, guest_email, guest_phone, guest_notes, check_in, check_out, adults, children, infants,
       pets, total_price_mxn, payment_provider, partner_id, partner_payout_mxn,
       partners ( name, email, phone, bank_name, bank_clabe ),
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
    .select('name, unit_price_mxn, quantity, subtotal_mxn, answers')
    .eq('booking_id', bookingId)

  const addonsText = (bookingAddons ?? []).length
    ? (bookingAddons ?? [])
        .map(
          (a) =>
            `- ${a.name}${a.quantity > 1 ? ` x${a.quantity}` : ''}: $${Number(a.subtotal_mxn).toLocaleString('es-MX')} MXN` +
            // Respuestas del huésped (ej. mensaje del letrero, sabor de pizza).
            ((a.answers as { label: string; value: string }[] | null) ?? [])
              .map((ans) => `\n   • ${ans.label}: ${ans.value}`)
              .join('')
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
    guest_whatsapp_link: whatsappDigits(booking.guest_phone) ? `https://wa.me/${whatsappDigits(booking.guest_phone)}` : '',
  }
  // Cabaña de socio (ver src/lib/partners.ts): al correo del administrador se
  // le agrega cuánto hay que pagarle al socio y cuándo.
  const partner = booking.partner_id
    ? ((Array.isArray(booking.partners) ? booking.partners[0] : booking.partners) as {
        name: string
        email: string
        phone: string | null
        bank_name: string | null
        bank_clabe: string | null
      } | null)
    : null
  const payout = Number(booking.partner_payout_mxn ?? 0)
  const payDate = (() => {
    const d = new Date(`${booking.check_in}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + 1)
    return d.toISOString().slice(0, 10)
  })()
  const money = (n: number) => `$${Math.round(n).toLocaleString('es-MX')} MXN`
  const adminPartnerNote = partner
    ? `🤝 Cabaña de socio: ${partner.name}.\nPagar al socio: ${money(payout)} el ${payDate} (día siguiente del check-in)` +
      (partner.bank_clabe ? ` a ${partner.bank_name ?? 'su cuenta'} terminación ${partner.bank_clabe.slice(-4)}.` : '. ⚠️ Aún no registra datos de pago.') +
      `\nTe queda: ${money(Number(booking.total_price_mxn ?? 0) - payout)} (antes de comisión de Stripe).` +
      `\nWhatsApp del socio: ${partner.phone ?? '—'}` +
      (partner.phone
        ? `\n\n` +
          waButton(
            partner.phone,
            `¡Hola ${partner.name.split(' ')[0]}! Se reservó tu espacio ${property.name ?? ''} del ${booking.check_in} al ${booking.check_out} (${booking.guest_name ?? 'huésped'}). Ya te llegó el correo con los datos. 🙌`,
            'Avisar al socio por WhatsApp'
          )
        : '')
    : ''
  data.partner_payout = partner ? money(payout) : ''

  // Solo para el cuerpo (HTML): el asunto es texto plano.
  const whatsappButton = whatsappButtonHtml(data.guest_phone, data.guest_name, data.property_name, data.check_in)
  const bodyData = { ...data, guest_whatsapp_button: whatsappButton }

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

    if (overrideTo && overrideTo.length > 0) recipients = overrideTo

    if (recipients.length === 0) {
      errors.push(`"${template.subject}" no se mandó: no hay ningún correo destinatario.`)
      continue
    }

    const result = await sendEmail({
      to: recipients,
      subject: renderSubject(template.subject, data),
      html: wrapBrandedEmail(
        renderBodyHtml(
          template.recipient_type === 'admin' && adminPartnerNote
            ? `${withWhatsappButton(template, whatsappButton).trimEnd()}\n\n${adminPartnerNote}`
            : withWhatsappButton(template, whatsappButton),
          bodyData
        )
      ),
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

  // Aviso al socio dueño de la cabaña (solo en el envío normal, no cuando se
  // reenvían correos elegidos a mano).
  if (partner?.email && !templateIds && !overrideTo) {
    const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
    const html = wrapBrandedEmail(
      [
        `Hola ${esc(partner.name)},`,
        `¡Hey! <strong>${esc(data.guest_name)}</strong> reservó tu espacio <strong>${esc(data.property_name)}</strong> en Huasca Retreats. 🎉`,
        `<strong>Llegada:</strong> ${data.check_in}<br /><strong>Salida:</strong> ${data.check_out}<br /><strong>Noches:</strong> ${nights}<br />` +
          `<strong>Huéspedes:</strong> ${data.adults} adultos, ${data.children} niños, ${data.infants} bebés · mascotas: ${data.pets}`,
        `<strong>Huésped:</strong> ${esc(data.guest_name)}<br /><strong>Teléfono:</strong> ${esc(data.guest_phone)}<br /><strong>Correo:</strong> ${esc(data.guest_email)}` +
          (data.guest_notes ? `<br /><strong>Notas:</strong> ${esc(data.guest_notes)}` : ''),
        waButton(
          data.guest_phone,
          `Hola ${data.guest_name.split(' ')[0]}, soy ${partner.name.split(' ')[0]}, anfitrión de ${data.property_name} (reservaste por Huasca Retreats). Te escribo para coordinar tu llegada el ${data.check_in}. 🙌`,
          'Escribir por WhatsApp al huésped'
        ),
        `Tú eres responsable de recibir al huésped, de la limpieza y de su atención durante la estancia.`,
        `<strong>Recibes:</strong> ${money(payout)}, que te depositamos el ${payDate} (día siguiente del check-in)` +
          (partner.bank_clabe ? ` a tu cuenta terminación ${partner.bank_clabe.slice(-4)}.` : '. ⚠️ Registra tus datos de pago en tu panel para poder depositarte.'),
        `Las fechas ya quedaron bloqueadas en tu calendario de Huasca Retreats. Si también rentas por otras plataformas sin calendario conectado, bloquéalas allá hoy mismo.`,
        `Recuerda: esta reserva es un compromiso con el huésped. Cancelarla puede tener penalización. Si surge cualquier problema, escríbenos de inmediato.`,
        `Tu panel: <a href="https://huascaretreats.com/socios">huascaretreats.com/socios</a>`,
      ]
        .filter(Boolean)
        .map((p) => `<p style="margin:0 0 16px 0;">${p}</p>`)
        .join('')
    )
    const result = await sendEmail({
      to: [partner.email],
      subject: `Se reservó tu espacio ${data.property_name}: ${data.check_in} → ${data.check_out}`,
      html,
      attachments: [
        { filename: 'huasca-retreats.png', content: Buffer.from(LOGO_PNG_BASE64, 'base64'), cid: LOGO_CID, contentType: 'image/png' },
      ],
    })
    if (result.ok) sent += 1
    else errors.push(`Aviso al socio: ${result.error}`)
  }

  return { sent, errors }
}
