'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'

function InnerForm({ onConfirmed, onError }: { onConfirmed: (paymentIntentId: string) => void; onError: (msg: string) => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })

    if (error) {
      onError(error.message ?? 'No se pudo procesar el pago. Intenta con otra tarjeta.')
      setSubmitting(false)
      return
    }

    if (paymentIntent?.status === 'succeeded') {
      onConfirmed(paymentIntent.id)
    } else {
      onError('El pago no se completó. Intenta de nuevo.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* terms: 'never' apaga el texto legal que pone Stripe por default
          (sobre guardar la tarjeta para cargos futuros) — lo reemplazamos
          por nuestro propio texto abajo, que ya incluye ese permiso además
          de las políticas del establecimiento. */}
      <PaymentElement options={{ terms: { card: 'never' } }} />
      {/* El aviso completo (incluye la autorización para guardar la tarjeta
          para cargos futuros por extras/daños) vive en /politicas — aquí
          solo queda el link, para no meterle al huésped un párrafo de texto
          legal justo antes de pagar. */}
      <p className="text-xs text-stone">
        Al reservar, aceptas nuestras{' '}
        <Link href="/politicas" target="_blank" className="text-gold underline underline-offset-2">
          políticas
        </Link>{' '}
        y el{' '}
        <Link href="/reglamento" target="_blank" className="text-gold underline underline-offset-2">
          reglamento
        </Link>
        .
      </p>
      <button
        type="submit"
        disabled={!stripe || submitting}
        className="w-full rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-navy-deep hover:bg-gold-light transition disabled:opacity-50"
      >
        {submitting ? 'Procesando…' : 'Pagar y confirmar reserva'}
      </button>
    </form>
  )
}

export default function StripePaymentForm({
  publishableKey,
  clientSecret,
  onConfirmed,
  onError,
}: {
  publishableKey: string
  clientSecret: string
  onConfirmed: (paymentIntentId: string) => void
  onError: (msg: string) => void
}) {
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey])

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, locale: 'es' }}>
      <InnerForm onConfirmed={onConfirmed} onError={onError} />
    </Elements>
  )
}
