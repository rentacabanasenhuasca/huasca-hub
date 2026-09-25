'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireHost } from '@/lib/hosts'

async function assertOwnsProperty(
  supabase: Awaited<ReturnType<typeof createClient>>,
  hostId: string,
  propertyId: string
) {
  const { data } = await supabase
    .from('properties')
    .select('id')
    .eq('id', propertyId)
    .eq('host_id', hostId)
    .maybeSingle()
  if (!data) throw new Error('Propiedad no encontrada.')
}

function readTemplateFields(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim()
  const recipientType = String(formData.get('recipient_type') ?? '')
  const recipientEmails = String(formData.get('recipient_emails') ?? '').trim()
  const subject = String(formData.get('subject') ?? '').trim()
  const body = String(formData.get('body') ?? '').trim()

  if (!name) return { error: 'Ponle un nombre a este correo (ej. "Confirmación para el huésped").' }
  if (!['guest', 'admin', 'custom'].includes(recipientType)) return { error: 'Elige a quién se le manda.' }
  if (recipientType === 'custom' && !recipientEmails) {
    return { error: 'Escribe al menos un correo destinatario.' }
  }
  if (!subject) return { error: 'Falta el asunto del correo.' }
  if (!body) return { error: 'Falta el cuerpo del correo.' }

  return {
    error: null as string | null,
    fields: {
      name,
      recipient_type: recipientType,
      recipient_emails: recipientType === 'custom' ? recipientEmails : null,
      subject,
      body,
    },
  }
}

export async function addEmailTemplate(propertyId: string, formData: FormData) {
  const host = await requireHost()
  const supabase = await createClient()
  await assertOwnsProperty(supabase, host.id, propertyId)

  const parsed = readTemplateFields(formData)
  if (parsed.error) return { error: parsed.error }

  const { error } = await supabase.from('email_templates').insert({ property_id: propertyId, ...parsed.fields })
  if (error) return { error: `No se pudo guardar: ${error.message}` }

  revalidatePath(`/admin/propiedades/${propertyId}`)
  return { error: null }
}

export async function updateEmailTemplate(propertyId: string, templateId: string, formData: FormData) {
  const host = await requireHost()
  const supabase = await createClient()
  await assertOwnsProperty(supabase, host.id, propertyId)

  const parsed = readTemplateFields(formData)
  if (parsed.error) return { error: parsed.error }

  const { error } = await supabase
    .from('email_templates')
    .update({ ...parsed.fields, updated_at: new Date().toISOString() })
    .eq('id', templateId)
    .eq('property_id', propertyId)

  if (error) return { error: `No se pudo guardar: ${error.message}` }

  revalidatePath(`/admin/propiedades/${propertyId}`)
  return { error: null }
}

export async function deleteEmailTemplate(propertyId: string, templateId: string) {
  const host = await requireHost()
  const supabase = await createClient()
  await assertOwnsProperty(supabase, host.id, propertyId)

  await supabase.from('email_templates').delete().eq('id', templateId).eq('property_id', propertyId)
  revalidatePath(`/admin/propiedades/${propertyId}`)
}

export async function toggleEmailTemplate(propertyId: string, templateId: string, enabled: boolean) {
  const host = await requireHost()
  const supabase = await createClient()
  await assertOwnsProperty(supabase, host.id, propertyId)

  await supabase
    .from('email_templates')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('id', templateId)
    .eq('property_id', propertyId)

  revalidatePath(`/admin/propiedades/${propertyId}`)
}

// Un punto de partida editable para no dejar al host frente a un formulario
// vacío — crea 2 correos típicos (huésped + administrador) que puede
// modificar o borrar como quiera.
export async function seedDefaultEmailTemplates(propertyId: string) {
  const host = await requireHost()
  const supabase = await createClient()
  await assertOwnsProperty(supabase, host.id, propertyId)

  const { count } = await supabase
    .from('email_templates')
    .select('id', { count: 'exact', head: true })
    .eq('property_id', propertyId)

  if (count && count > 0) return { error: 'Ya tienes correos configurados en esta cabaña.' }

  const { error } = await supabase.from('email_templates').insert([
    {
      property_id: propertyId,
      name: 'Confirmación para el huésped',
      recipient_type: 'guest',
      subject: 'Tu reserva en {{property_name}} está confirmada',
      body:
        'Hola {{guest_name}},\n\n' +
        '¡Tu reserva quedó confirmada! Aquí el resumen:\n\n' +
        'Cabaña: {{property_name}}\n' +
        'Llegada: {{check_in}}\n' +
        'Salida: {{check_out}}\n' +
        'Noches: {{nights}}\n' +
        'Huéspedes: {{adults}} adultos, {{children}} niños, {{infants}} infantes\n' +
        'Total pagado: {{total}}\n\n' +
        'Cualquier duda, escríbenos a {{host_email}} o al {{host_phone}}.\n\n' +
        '¡Te esperamos en Huasca de Ocampo!',
    },
    {
      property_id: propertyId,
      name: 'Notificación para mí (administrador)',
      recipient_type: 'admin',
      subject: 'Nueva reserva: {{property_name}} ({{check_in}} — {{check_out}})',
      body:
        'Nueva reserva confirmada.\n\n' +
        'Cabaña: {{property_name}}\n' +
        'Huésped: {{guest_name}} ({{guest_email}}, {{guest_phone}})\n' +
        'Llegada: {{check_in}}\n' +
        'Salida: {{check_out}}\n' +
        'Noches: {{nights}}\n' +
        'Huéspedes: {{adults}} adultos, {{children}} niños, {{infants}} infantes, mascotas: {{pets}}\n' +
        'Total: {{total}} · Pagado con: {{payment_provider}}\n' +
        'Notas del huésped: {{guest_notes}}\n' +
        'ID de reserva: {{booking_id}}',
    },
  ])

  if (error) return { error: `No se pudieron crear: ${error.message}` }

  revalidatePath(`/admin/propiedades/${propertyId}`)
  return { error: null }
}
