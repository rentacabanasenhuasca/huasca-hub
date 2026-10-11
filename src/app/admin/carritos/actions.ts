'use server'

import { revalidatePath } from 'next/cache'
import { requireHost } from '@/lib/hosts'
import { createServiceClient } from '@/lib/supabase/service'
import { sendCartGuestEmail, importStripeCarts } from '@/lib/carts'
import { isUuid } from '@/lib/is-uuid'

async function ownCart(cartId: string) {
  const host = await requireHost()
  if (!isUuid(cartId)) return null
  const supabase = createServiceClient()
  const { data } = await supabase.from('checkout_carts').select('id, host_id, status').eq('id', cartId).maybeSingle()
  if (!data || data.host_id !== host.id) return null
  return { supabase, cart: data }
}

export async function setCartAutoEmail(enabled: boolean) {
  const host = await requireHost()
  const supabase = createServiceClient()
  const { error } = await supabase.from('hosts').update({ cart_auto_email: enabled }).eq('id', host.id)
  if (error) return { error: `No se pudo guardar: ${error.message}` }
  revalidatePath('/admin/carritos')
  return { error: null }
}

export async function sendCartEmailAction(cartId: string) {
  const own = await ownCart(cartId)
  if (!own) return { error: 'No se encontró el carrito.' }
  const result = await sendCartGuestEmail(cartId, own.supabase)
  if (!result.ok) return { error: result.error }
  revalidatePath('/admin/carritos')
  return { error: null }
}

export async function setCartStatus(cartId: string, status: 'abierto' | 'contactado' | 'recuperado' | 'descartado') {
  if (!['abierto', 'contactado', 'recuperado', 'descartado'].includes(status)) return { error: 'Estado inválido.' }
  const own = await ownCart(cartId)
  if (!own) return { error: 'No se encontró el carrito.' }
  const update: Record<string, unknown> = { status }
  if (status === 'contactado') update.contacted_at = new Date().toISOString()
  const { error } = await own.supabase.from('checkout_carts').update(update).eq('id', cartId)
  if (error) return { error: `No se pudo guardar: ${error.message}` }
  revalidatePath('/admin/carritos')
  return { error: null }
}

export async function importStripeCartsAction() {
  const host = await requireHost()
  try {
    const r = await importStripeCarts(host.id, 10)
    revalidatePath('/admin/carritos')
    return { error: null, imported: r.imported }
  } catch (err) {
    return { error: `No se pudo leer Stripe: ${(err as Error).message}`, imported: 0 }
  }
}
