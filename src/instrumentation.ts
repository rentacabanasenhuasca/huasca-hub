// Sincronización automática de calendarios externos (Airbnb, Booking...)
// cada 3 minutos, para que nunca pase mucho tiempo entre que alguien reserva
// en Airbnb y esa fecha queda bloqueada aquí (evita dobles reservas).
//
// register() se llama UNA sola vez cuando arranca el proceso del servidor
// de Next.js (ver node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md).
// Aquí arrancamos un setInterval de larga duración — SOLO sirve mientras
// el servidor vive corriendo sin parar (`npm run dev` o `npm start` en una
// máquina o servidor propio). En Vercel (o cualquier plataforma
// serverless) cada request puede arrancar una instancia nueva y este
// setInterval nunca llega a los 3 minutos, así que ahí la sincronización
// corre por otro lado: /api/cron/sync-ical, llamado por un cron externo
// (ver README/instrucciones de despliegue). Por eso aquí nos saltamos por
// completo el setInterval cuando detectamos que estamos en Vercel.
const SYNC_INTERVAL_MS = 3 * 60 * 1000 // 3 minutos

export async function register() {
  // Solo en el runtime de Node (no en Edge) y no durante el build.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // En Vercel la sincronización va por /api/cron/sync-ical (llamado por un
  // cron externo), no por este setInterval de larga duración.
  if (process.env.VERCEL) return

  // Guard global: evita que se dupliquen los intervalos si register() se
  // vuelve a invocar (por ejemplo, con hot-reload en desarrollo dentro del
  // mismo proceso).
  const g = globalThis as unknown as { __huascaIcalSyncStarted?: boolean }
  if (g.__huascaIcalSyncStarted) return
  g.__huascaIcalSyncStarted = true

  const { syncAllIcalSourcesGlobally } = await import('@/lib/ical-sync')

  async function runSync() {
    try {
      const result = await syncAllIcalSourcesGlobally()
      if (result.errors.length > 0) {
        console.warn('[ical-auto-sync]', result.errors.join(' · '))
      }
    } catch (err) {
      console.warn('[ical-auto-sync] fallo inesperado:', (err as Error).message)
    }
  }

  // Primera sincronización en cuanto arranca el servidor (no esperar 3
  // minutos para la primera pasada), y luego cada SYNC_INTERVAL_MS.
  runSync()
  setInterval(runSync, SYNC_INTERVAL_MS)
}
