'use client'

// Si algo falla en el panel (lo más común: se publicó una versión nueva del
// sitio mientras la página estaba abierta), en vez de la pantalla genérica
// "This page couldn't load" se explica qué pasó y cómo seguir.
export default function PanelError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  console.error(error)
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-stone/15 bg-white p-6 text-center">
      <p className="text-3xl" aria-hidden>🔄</p>
      <h2 className="mt-2 text-lg font-semibold text-navy-deep">No se pudo completar la acción</h2>
      <p className="mt-2 text-sm text-stone">
        Lo más probable es que se haya publicado una versión nueva del sistema mientras tenías esta página abierta. Recarga
        la página y vuelve a hacer el último cambio (puede que no se haya guardado).
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-5 rounded-full bg-navy-deep px-5 py-2 text-sm font-semibold text-cream hover:bg-navy transition"
      >
        Recargar página
      </button>
    </div>
  )
}
