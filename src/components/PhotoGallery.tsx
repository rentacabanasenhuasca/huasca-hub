'use client'

// Grid de portada (igual que antes: 1 foto grande + 4 chicas) más un botón
// "Ver todas las fotos" que abre una galería de pantalla completa con TODAS
// las fotos que subió el host — antes solo se veían esas primeras 5 y no
// había forma de ver el resto.
import { useEffect, useState } from 'react'

type Photo = { url: string; category: string | null; description: string | null }

export default function PhotoGallery({ photos, alt }: { photos: Photo[]; alt: string }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  if (photos.length === 0) {
    return (
      <div className="h-56 sm:h-72 rounded-3xl bg-white border border-stone/10 flex items-center justify-center text-stone mb-8">
        Sin fotos todavía
      </div>
    )
  }

  return (
    <>
      <div className="relative rounded-3xl overflow-hidden mb-8">
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 h-64 sm:h-[420px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[0].url}
            alt={alt}
            className="col-span-4 sm:col-span-2 row-span-2 h-full w-full object-cover cursor-pointer"
            onClick={() => setOpen(true)}
          />
          {photos.slice(1, 5).map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={p.url}
              alt={p.description ?? ''}
              className="hidden sm:block h-full w-full object-cover cursor-pointer"
              onClick={() => setOpen(true)}
            />
          ))}
        </div>
        {photos.length > 1 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 rounded-full bg-white/95 backdrop-blur px-4 py-2 text-xs sm:text-sm font-medium text-navy-deep shadow-md hover:bg-white transition"
          >
            Ver todas las fotos ({photos.length})
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-navy-deep/98 overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center justify-between bg-navy-deep/98 px-4 py-3 sm:px-6">
            <p className="text-cream text-sm">
              {photos.length} {photos.length === 1 ? 'foto' : 'fotos'}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="rounded-full bg-white/10 hover:bg-white/20 text-cream h-9 w-9 flex items-center justify-center transition"
            >
              ✕
            </button>
          </div>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-10 grid gap-3 sm:grid-cols-2">
            {photos.map((p, i) => (
              <figure key={i} className="rounded-2xl overflow-hidden bg-white/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.description ?? ''} className="w-full h-auto object-cover" />
                {(p.category || p.description) && (
                  <figcaption className="px-3 py-2 text-xs text-cream/70">
                    {[p.category, p.description].filter(Boolean).join(' — ')}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
