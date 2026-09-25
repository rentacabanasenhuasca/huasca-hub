// Webhook de Mercado Pago — misma idea que el de Stripe: red de seguridad
// para eventos asíncronos, el flujo principal ya confirma la reserva de
// inmediato en checkout-actions.ts. Mercado Pago no firma sus webhooks con
// un secreto por defecto (a diferencia de Stripe), así que solo registramos
// el evento para investigar si algo no cuadra.
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (body?.type === 'payment') {
    console.log('[mercadopago webhook] payment', body.data?.id)
  }
  return NextResponse.json({ received: true })
}
