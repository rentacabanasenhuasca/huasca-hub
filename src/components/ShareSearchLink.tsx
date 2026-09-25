'use client'

// El link de búsqueda (con fechas/huéspedes) ya queda armado en la URL solo
// con buscar — esto solo le ahorra a Christian tener que seleccionar la
// barra del navegador para copiarlo: un botón directo para copiar el link
// o mandarlo ya armado por WhatsApp a quien le esté preguntando.
import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export default function ShareSearchLink() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [copied, setCopied] = useState(false)
  // El origin (https://tudominio.com) solo existe en el navegador — leerlo
  // directo con `typeof window` durante el render causaba un mismatch de
  // hidratación (el servidor no lo puede saber, así que rendería distinto
  // al cliente). Se llena después de montar, en un efecto: el primer render
  // en el navegador coincide con el del servidor (origin vacío) y solo
  // después se actualiza, que es un re-render normal, no un mismatch.
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    // Lectura de window.location, imposible de hacer en el render (el
    // servidor no la tiene) — este es justo el caso que este patrón cubre.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin)
  }, [])

  const url = `${origin}${pathname}?${searchParams.toString()}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Sin acceso al portapapeles (ej. http sin permiso) — no pasa nada,
      // el link sigue disponible en la barra del navegador como siempre.
    }
  }

  const waText = encodeURIComponent(`Mira estas cabañas disponibles: ${url}`)

  return (
    <div className="flex items-center gap-3 text-xs">
      <button
        type="button"
        onClick={copyLink}
        className="rounded-full border border-stone/25 px-3 py-1.5 text-navy-deep hover:bg-white transition"
      >
        {copied ? 'Copiado ✓' : 'Copiar link'}
      </button>
      <a
        href={`https://wa.me/?text=${waText}`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full border border-stone/25 px-3 py-1.5 text-navy-deep hover:bg-white transition"
      >
        Compartir por WhatsApp
      </a>
    </div>
  )
}
