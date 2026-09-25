// Página de "gracias" / confirmación de reserva — vive en su propia ruta
// (en vez de ser un estado dentro de /cabanas/[id]/reservar) por una razón
// concreta: justo después de pagar, el servidor revalida la disponibilidad
// de esa cabaña (para que el calendario y la propia página de la cabaña se
// actualicen). Si la confirmación se mostrara como un simple estado dentro
// de la página de checkout, ese refresco automático volvía a checar
// disponibilidad, veía las fechas recién bloqueadas por la misma reserva, y
// reemplazaba el "¡Reserva confirmada!" por un falso "ya no disponible" —
// aunque la reserva sí se había guardado bien. Al mandar al huésped a una
// URL aparte, ese refresco ya no la afecta.
//
// De paso, esta es la página ideal para instalar más adelante el Meta Pixel
// / eventos de conversión (Purchase / Lead) que se disparan solo cuando una
// reserva de verdad se completó.
import Link from 'next/link'
import Image from 'next/image'
import { createServiceClient } from '@/lib/supabase/service'

export default async function ReservaConfirmadaPage({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string }>
}) {
  const { bookingId } = await searchParams
  const supabase = createServiceClient()

  const booking = bookingId
    ? (
        await supabase
          .from('bookings')
          .select('id, guest_name, check_in, check_out, properties ( name )')
          .eq('id', bookingId)
          .maybeSingle()
      ).data
    : null

  const property = booking
    ? Array.isArray(booking.properties)
      ? booking.properties[0]
      : booking.properties
    : null

  return (
    <div className="font-body min-h-full bg-cream flex flex-col">
      <div className="px-4 pt-4">
        <div className="max-w-md mx-auto flex justify-center">
          <Link href="/" aria-label="Huasca Retreats">
            <Image
              src="/logo.png"
              alt="Huasca Retreats"
              width={800}
              height={750}
              className="h-16 w-auto sm:h-20 drop-shadow-md"
            />
          </Link>
        </div>
      </div>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="max-w-md w-full rounded-3xl border border-stone/10 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold/15">
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-gold" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="font-display text-2xl text-navy-deep">¡Reserva confirmada!</p>

          {booking ? (
            <p className="text-sm text-stone mt-3">
              {property?.name ? (
                <>
                  Tu estancia en <strong className="text-navy-deep">{property.name}</strong> del{' '}
                  <strong className="text-navy-deep">{booking.check_in}</strong> al{' '}
                  <strong className="text-navy-deep">{booking.check_out}</strong> quedó lista.
                </>
              ) : (
                'Tu reserva quedó lista.'
              )}{' '}
              Te contactaremos por correo o WhatsApp con los detalles.
            </p>
          ) : (
            <p className="text-sm text-stone mt-3">
              Te esperamos pronto. Te contactaremos por correo o WhatsApp con los detalles de tu reserva.
            </p>
          )}

          <Link
            href="/"
            className="mt-6 inline-block rounded-full bg-navy px-5 py-2.5 text-sm font-medium text-cream hover:bg-navy-deep transition"
          >
            Volver al inicio
          </Link>
        </div>
      </main>
    </div>
  )
}
