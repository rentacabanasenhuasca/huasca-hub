'use server'

// Acciones que llama el checkout para ir guardando el carrito (ver
// src/lib/carts.ts). Son "mejor esfuerzo": si algo falla, el huésped sigue
// pagando normal, nunca se le muestra un error por esto.
import { saveCart, markCart, type CartInput } from '@/lib/carts'

export async function saveCartAction(input: CartInput) {
  try {
    await saveCart(input)
  } catch (err) {
    console.warn('[carritos] saveCartAction', (err as Error).message)
  }
}

export async function markCartAction(
  cartId: string,
  stage: 'pago_iniciado' | 'pago_rechazado' | 'reservado',
  opts: { provider?: string; error?: string; bookingId?: string } = {}
) {
  try {
    await markCart(cartId, stage, opts)
  } catch (err) {
    console.warn('[carritos] markCartAction', (err as Error).message)
  }
}
