// Ayudante centralizado para disparar eventos del Meta Pixel desde
// cualquier componente cliente. El pixel base (script fbq + init +
// PageView) se carga una sola vez en <MetaPixel /> (ver
// components/MetaPixel.tsx), montado en el layout raíz — esta función
// nunca vuelve a cargar el script, solo llama a window.fbq si ya existe.
//
// Pixel usado: "rch" (194756374229884), el mismo que ya está configurado
// en TitansHub/PixelYourSite — es el mismo negocio, mismo pixel, para no
// fragmentar los datos de conversión entre dos pixeles distintos.
declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

export function trackMetaEvent(eventName: string, params?: Record<string, unknown>, eventId?: string) {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return
  if (eventId) {
    // eventID permite deduplicar con Conversions API (server-side) más
    // adelante si se agrega, usando el mismo id (ej. el id de la reserva)
    // para el mismo evento visto por las dos vías.
    window.fbq('track', eventName, params ?? {}, { eventID: eventId })
  } else {
    window.fbq('track', eventName, params ?? {})
  }
}
