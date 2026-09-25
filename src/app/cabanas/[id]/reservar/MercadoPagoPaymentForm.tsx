'use client'

import { useEffect } from 'react'
import { CardPayment, initMercadoPago } from '@mercadopago/sdk-react'

// initMercadoPago es una llamada de inicialización del SDK (registra la
// llave pública globalmente), no estado de React — solo necesita correr
// una vez por publicKey, dentro de un efecto para no mutar nada durante el
// render.
let initializedKey: string | null = null
function ensureMercadoPagoInit(publicKey: string) {
  if (initializedKey === publicKey) return
  initMercadoPago(publicKey, { locale: 'es-MX' })
  initializedKey = publicKey
}

type SubmitData = {
  token: string
  issuer_id: string
  payment_method_id: string
  installments: number
}

export default function MercadoPagoPaymentForm({
  publicKey,
  total,
  guestEmail,
  onSubmitToken,
  onError,
}: {
  publicKey: string
  total: number
  guestEmail: string
  onSubmitToken: (data: SubmitData) => Promise<void>
  onError: (msg: string) => void
}) {
  useEffect(() => {
    ensureMercadoPagoInit(publicKey)
  }, [publicKey])

  return (
    <CardPayment
      initialization={{ amount: total, payer: { email: guestEmail } }}
      customization={{ visual: { hideFormTitle: true } }}
      onSubmit={async (formData: SubmitData) => {
        await onSubmitToken({
          token: formData.token,
          issuer_id: formData.issuer_id,
          payment_method_id: formData.payment_method_id,
          installments: formData.installments,
        })
      }}
      onError={(err: { message?: string }) => {
        onError(err.message || 'No se pudo procesar la tarjeta. Revisa los datos e intenta de nuevo.')
      }}
    />
  )
}
