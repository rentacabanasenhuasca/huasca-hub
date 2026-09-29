import Image from 'next/image'

// Pagina temporal de "en construccion". Se activa desde middleware.ts
// cuando la variable de entorno MAINTENANCE_MODE=true, para frenar
// reservas nuevas en el sitio mientras Christian pone el sistema en orden
// (evita reservas duplicadas). El panel de admin y las rutas /api (ical,
// webhooks de pago) siguen funcionando normal.
//
// Para quitarla: borrar/cambiar MAINTENANCE_MODE en Coolify y redeploy -
// no requiere tocar codigo.
export const metadata = {
  title: 'Huasca Retreats — En mantenimiento',
  robots: { index: false, follow: false },
}

const WHATSAPP_NUMBER = '525527327670'
const WHATSAPP_MESSAGE = 'Hola, quiero hacer una reserva en Huasca Retreats'
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`

export default function MantenimientoPage() {
  return (
    <div className="font-body min-h-screen bg-cream flex flex-col items-center justify-center px-6 text-center">
      <Image
        src="/logo.png"
        alt="Huasca Retreats"
        width={800}
        height={750}
        className="h-24 w-auto mb-8 drop-shadow-md"
      />
      <h1 className="font-display text-3xl sm:text-4xl text-navy-deep mb-4">
        Estamos actualizando nuestro sistema de reservas
      </h1>
      <p className="text-base text-stone max-w-md mb-8 leading-relaxed">
        Por un momento no puedes reservar aqui en linea. Escribenos por WhatsApp y con gusto te
        ayudamos a apartar tu cabana.
      </p>
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-8 py-3.5 text-base font-medium text-white shadow-lg hover:brightness-95 transition"
      >
        Reservar por WhatsApp
      </a>
      <p className="text-xs text-stone mt-6">Huasca de Ocampo, Hidalgo</p>
    </div>
  )
}
