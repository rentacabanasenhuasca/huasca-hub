// Envío de correos — SOLO para uso en el servidor. Usa Resend (API por
// HTTPS) en vez de SMTP directo: el VPS bloquea los puertos de correo
// saliente (465/587) hasta que Hetzner los desbloquee manualmente (y solo
// lo hace en cuentas con más de un mes de antigüedad), así que una API por
// HTTPS evita ese problema por completo. Ninguna de estas variables lleva
// el prefijo NEXT_PUBLIC_, así que Next.js nunca las manda al navegador.
//
// Variables que hay que poner en .env.local (y en el hosting cuando el
// sitio esté en línea):
//   RESEND_API_KEY=re_...
//   EMAIL_FROM="Huasca Retreats <reservaciones@huascaretreats.com>"
//     (mientras el dominio propio no esté verificado en Resend, usa algo
//     como "Huasca Retreats <onboarding@resend.dev>" — Resend deja mandar
//     desde ahí sin verificar dominio, solo para pruebas)
import { Resend } from 'resend'

let resend: Resend | null = null

function getResend() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  if (!resend) resend = new Resend(apiKey)
  return resend
}

export type SendEmailAttachment = {
  filename: string
  content: Buffer
  cid?: string // para referenciar la imagen inline en el html como cid:<cid>
  contentType?: string
}

export type SendEmailInput = {
  to: string[]
  subject: string
  html: string
  attachments?: SendEmailAttachment[]
}

export type SendEmailResult = { ok: true } | { ok: false; error: string }

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const client = getResend()
  if (!client) {
    // Sin RESEND_API_KEY configurada no hay forma de mandar correos — no
    // truena la reserva por esto, solo se registra para que se note en los
    // logs mientras se termina de configurar el envío.
    console.warn('[email] Resend no configurado — correo NO enviado:', input.subject)
    return { ok: false, error: 'Envío de correos no configurado (falta RESEND_API_KEY).' }
  }

  const from = process.env.EMAIL_FROM || 'Huasca Retreats <onboarding@resend.dev>'

  try {
    const { error } = await client.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      attachments: input.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentId: a.cid,
      })),
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}
