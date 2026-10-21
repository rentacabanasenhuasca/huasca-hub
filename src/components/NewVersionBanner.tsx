'use client'

// Aviso en el panel: si se publicó una versión nueva del sitio mientras esta
// página estaba abierta, pide recargar ANTES de seguir — con la versión vieja
// los botones de guardar ya no funcionan y los cambios se pierden.
import { useEffect, useState } from 'react'

export default function NewVersionBanner({ buildId }: { buildId: string | null }) {
  const [outdated, setOutdated] = useState(false)

  useEffect(() => {
    if (!buildId) return
    let stopped = false
    async function check() {
      try {
        const res = await fetch('/api/build-id', { cache: 'no-store' })
        const current = (await res.text()).trim()
        if (!stopped && current && current !== buildId) setOutdated(true)
      } catch {
        // Sin conexión o servidor reiniciando: se vuelve a intentar luego.
      }
    }
    const interval = setInterval(check, 60_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      clearInterval(interval)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [buildId])

  if (!outdated) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] p-3">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 rounded-2xl bg-navy-deep px-5 py-4 text-cream shadow-2xl sm:flex-row sm:justify-between">
        <p className="text-sm">
          <span className="font-semibold text-gold-light">Hay una versión nueva del sistema.</span> Recarga la página antes
          de seguir para que tus cambios se guarden.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="shrink-0 rounded-full bg-gold px-5 py-2 text-sm font-semibold text-navy-deep hover:bg-gold-light transition"
        >
          Recargar ahora
        </button>
      </div>
    </div>
  )
}
