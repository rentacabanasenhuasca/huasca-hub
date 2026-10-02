'use client'

// El botón "Reservar y pagar" de la página de una cabaña es donde el
// huésped ya eligió fechas/huéspedes y decide avanzar — antes este botón
// era un <Link> sin ningún evento del Meta Pixel, así que Meta "adivinaba"
// solo qué evento disparar con su detección automática y lo etiquetaba mal
// (como "SubscribedButtonClick", un falso positivo).
//
// Se usa AddToCart (no InitiateCheckout) a propósito: InitiateCheckout ya
// se dispara correctamente un paso más adelante, en
// app/cabanas/[id]/reservar/ReservarClient.tsx, cuando el huésped llena sus
// datos y da clic en "Continuar al pago" — ese es el punto que de verdad
// corresponde al inicio del checkout en la semántica estándar de Meta. Si
// este botón también disparara InitiateCheckout, se estaría duplicando esa
// señal dos veces para la misma sesión y diluyendo su valor para optimizar
// campañas. AddToCart es la señal correcta para "seleccionó algo para
// comprar", un paso antes.
import Link from 'next/link'
import { trackMetaEvent } from '@/lib/meta-pixel'

export default function TrackedBookLink({
  href,
  className,
  propertyId,
  value,
  children,
}: {
  href: string
  className?: string
  propertyId: string
  value: number
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        trackMetaEvent('AddToCart', { value, currency: 'MXN', content_ids: [propertyId] })
      }}
    >
      {children}
    </Link>
  )
}
