// Webhook de Stripe — red de seguridad para eventos asíncronos (por ejemplo
// un pago que se confirma vía 3-D Secure después de que el huésped ya salió
// de la página). El flujo principal confirma la reserva de inmediato en
// checkout-actions.ts; este endpoint solo registra lo que Stripe reporta
// para poder investigar si algo no cuadra. Requiere STRIPE_WEBHOOK_SECRET
// en .env.local (todavía vacío — se llena cuando se configure el webhook en
// el dashboard de Stripe o con `stripe listen` para pruebas locales).
import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    // Sin secreto configurado no podemos verificar que el evento venga
    // realmente de Stripe — mejor no procesar nada que confiar en un
    // webhook sin verificar.
    return NextResponse.json({ error: 'Webhook no configurado' }, { status: 501 })
  }

  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  const stripe = getStripe()
  let event
  try {
    event = stripe.webhooks.constructEvent(body, signature ?? '', secret)
  } catch (err) {
    return NextResponse.json({ error: `Firma inválida: ${(err as Error).message}` }, { status: 400 })
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
    case 'payment_intent.payment_failed':
    case 'charge.refunded':
      // El flujo síncrono ya maneja la confirmación normal. Aquí solo
      // dejamos rastro — si algún día se necesita reconciliar pagos que se
      // completaron de forma asíncrona, este es el lugar para agregar esa
      // lógica (buscar el booking por stripe_payment_intent_id y
      // actualizarlo).
      console.log(`[stripe webhook] ${event.type}`, event.id)
      break
    default:
      break
  }

  return NextResponse.json({ received: true })
}
