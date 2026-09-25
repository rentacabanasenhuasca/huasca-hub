'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireHost } from '@/lib/hosts'

type ActionState = { error: string | null; success?: boolean }

export async function updateHostSettings(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const host = await requireHost()
  const supabase = await createClient()

  const name = String(formData.get('name') || '').trim()
  const phone = String(formData.get('phone') || '').trim()
  const email = String(formData.get('email') || '').trim()

  if (!name) return { error: 'El nombre es obligatorio.' }
  if (!email) return { error: 'El correo es obligatorio.' }

  const { error } = await supabase
    .from('hosts')
    .update({ name, phone: phone || null, email })
    .eq('id', host.id)

  if (error) return { error: `No se pudo guardar: ${error.message}` }

  // Revalida todo el sitio público, no solo esta página: el teléfono
  // cambia el botón flotante de WhatsApp (layout raíz) y el link de
  // WhatsApp en cada cabaña.
  revalidatePath('/', 'layout')
  revalidatePath('/admin/configuracion')
  return { error: null, success: true }
}
