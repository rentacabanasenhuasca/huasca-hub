'use client'

// Dispara el evento Purchase del Meta Pixel una sola vez, cuando el
// huésped llega a /reserva-confirmada — es decir, solo cuando una reserva
// de verdad se completó y se guardó (ver el comentario en
// reserva-confirmada/page.tsx sobre por qué esa confirmación vive en su
// propia URL). Nunca se dispara desde el formulario de pago directamente,
// para no contar intentos fallidos o abandonados.
import { useEffect } from 'react'
import { trackMetaEvent } from '@/lib/meta-pixel'

export default function TrackPurchase({
  bookingId,
  propertyId,
  value,
}: {
  bookingId: string
  propertyId: string
  value: number
}) {
  useEffect(() => {
    // eventID = bookingId: si más adelante se agrega Conversions API
    // (server-side) con el mismo id, Meta deduplica en vez de contar el
    // mismo evento dos veces (una por el pixel del navegador, otra por el
    // servidor).
    trackMetaEvent(
      'Purchase',
      { value, currency: 'MXN', content_ids: [propertyId], content_type: 'product' },
      bookingId
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId])

  return null
}
