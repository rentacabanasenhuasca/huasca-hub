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

  // La sincronización de calendarios externos (Airbnb, etc.) ya NO corre
  // aquí: la hace la base de datos (pg_cron → sync_due_ical_sources, cada
  // minuto, respetando el intervalo de cada fuente). Correrla también desde
  // este proceso la duplicaba y gastaba memoria del servidor.

  // Carritos abandonados: cada 5 minutos revisa quién lleva 20+ minutos
  // sin terminar de pagar y avisa por correo (ver src/lib/carts.ts).
  const { processAbandonedCarts } = await import('@/lib/carts')
  setInterval(() => {
    processAbandonedCarts().catch((err) => console.warn('[carritos]', (err as Error).message))
  }, 5 * 60 * 1000)
}
