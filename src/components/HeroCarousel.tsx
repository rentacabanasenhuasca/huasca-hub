'use client'

import { useEffect, useState } from 'react'

export type HeroMediaItem = { id: string; media_type: 'image' | 'video'; url: string }

// Cuánto dura cada diapositiva (foto o video) antes de pasar a la siguiente.
// Para video no esperamos a que termine — igual se ve completo mientras
// hace loop, y así el carrusel avanza a un ritmo predecible.
const SLIDE_MS = 7000

export default function HeroCarousel({ items }: { items: HeroMediaItem[] }) {
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (items.length <= 1) return
    const timer = setInterval(() => {
      setActive((i) => (i + 1) % items.length)
    }, SLIDE_MS)
    return () => clearInterval(timer)
  }, [items.length])

  if (items.length === 0) return null

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {items.map((item, i) => (
        <div
          key={item.id}
          className="absolute inset-0 transition-opacity duration-[1200ms] ease-in-out"
          style={{ opacity: i === active ? 1 : 0 }}
        >
          {item.media_type === 'video' ? (
            <video
              src={item.url}
              className="h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload={i === 0 ? 'auto' : 'none'}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.url} alt="" className="h-full w-full object-cover" />
          )}
        </div>
      ))}
      {/* Oscurece la parte de abajo para que el texto del hero se siga
          leyendo bien sobre cualquier foto/video. */}
      <div className="absolute inset-0 bg-gradient-to-b from-navy-deep/55 via-navy-deep/35 to-navy-deep/80" />

      {items.length > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {items.map((item, i) => (
            <span
              key={item.id}
              className={`h-1.5 rounded-full transition-all ${i === active ? 'w-6 bg-gold' : 'w-1.5 bg-cream/50'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
