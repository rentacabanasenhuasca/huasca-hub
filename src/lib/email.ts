// Envío de correos — SOLO para uso en el servidor. Usa el correo de
// Hostinger vía SMTP (nodemailer), para que las confirmaciones salgan desde
// el dominio propio (ej. reservaciones@huascaretreats.com) en vez de una
// dirección genérica. Ninguna de estas variables lleva el prefijo
// NEXT_PUBLIC_, así que Next.js nunca las manda al navegador.
//
// Variables que hay que poner en .env.local (y en el hosting cuando el
// sitio esté en línea):
//   SMTP_HOST=smtp.hostinger.com
//   SMTP_PORT=465
//   SMTP_USER=reservaciones@huascaretreats.com
//   SMTP_PASS=<la contraseña de ese correo>
//   SMTP_FROM="Huasca Retreats <reservaciones@huascaretreats.com>"   (opcional, si no se pone usa SMTP_USER)
import nodemailer from 'nodemailer'

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null

function getTransporter() {
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !port || !user || !pass) return null

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      // El puerto 465 de Hostinger es SSL directo (secure: true); el 587
      // es STARTTLS (secure: false, pero sigue siendo cifrado).
      secure: Number(port) === 465,
      auth: { user, pass },
    })
  }
  return transporter
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
  const smtp = getTransporter()
  if (!smtp) {
    // Sin las variables SMTP configuradas no hay forma de mandar correos —
    // no truena la reserva por esto, solo se registra para que se note en
    // los logs mientras se termina de configurar el envío.
    console.warn('[email] SMTP no configurado — correo NO enviado:', input.subject)
    return { ok: false, error: 'Envío de correos no configurado (falta SMTP_HOST/SMTP_USER/SMTP_PASS).' }
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER!

  try {
    await smtp.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      attachments: input.attachments,
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}
