// Cliente de Stripe — SOLO para uso en el servidor (Server Actions, Route
// Handlers). STRIPE_SECRET_KEY nunca tiene el prefijo NEXT_PUBLIC_, así que
// Next.js no lo deja llegar al navegador.
import Stripe from 'stripe'

let stripeClient: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      throw new Error(
        'Falta STRIPE_SECRET_KEY en .env.local. Ve a tu dashboard de Stripe (modo de prueba) → Desarrolladores → Claves de API.'
      )
    }
    stripeClient = new Stripe(key)
  }
  return stripeClient
}
