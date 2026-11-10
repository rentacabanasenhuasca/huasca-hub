// Manda los correos de las reservas que se crearon directo en Supabase con
// emails_pending = true (ver supabase/migrations/20261110200000_booking_emails_pending.sql).
// Corre cada minuto desde instrumentation.ts.
//
// Cada reserva se "reclama" primero (emails_pending pasa a false en un solo
// UPDATE condicionado), así que aunque dos procesos corran a la vez, los
// correos de una reserva solo salen una vez. Solo toma reservas creadas en
// las últimas 24 horas, para que prender la bandera por error en una reserva
// vieja no dispare correos atrasados.
import { createServiceClient } from '@/lib/supabase/service'
import { sendBookingEmails } from '@/lib/booking-emails'

export async function processPendingBookingEmails() {
  const supabase = createServiceClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: pending, error } = await supabase
    .from('bookings')
    .select('id')
    .eq('emails_pending', true)
    .gte('created_at', since)
    .limit(20)

  if (error) throw new Error(error.message)

  let processed = 0
  for (const { id } of pending ?? []) {
    const { data: claimed } = await supabase
      .from('bookings')
      .update({ emails_pending: false })
      .eq('id', id)
      .eq('emails_pending', true)
      .select('id')
    if (!claimed?.length) continue

    try {
      const { sent, errors } = await sendBookingEmails(supabase, id)
      await supabase
        .from('bookings')
        .update({
          emails_sent_at: new Date().toISOString(),
          emails_result: `${sent} enviado(s)${errors.length ? ` · ${errors.join(' · ')}` : ''}`,
        })
        .eq('id', id)
    } catch (err) {
      await supabase
        .from('bookings')
        .update({ emails_result: `Error: ${(err as Error).message}` })
        .eq('id', id)
    }
    processed++
  }
  return { processed }
}
