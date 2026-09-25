'use client'

import { useEffect, useRef, useState } from 'react'
import type { GuestCounts } from '@/lib/occupancy'
import { guestsSummary } from '@/lib/occupancy'

// Selector de huéspedes tipo Airbnb: adultos/niños/infantes/mascotas con
// contadores, dentro de un <form method="get">. Manda su valor vía inputs
// ocultos, así que no necesita JS en el servidor para funcionar.
export default function GuestPicker({
  defaultGuests,
}: {
  defaultGuests: GuestCounts
}) {
  const [guests, setGuests] = useState<GuestCounts>(defaultGuests)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function update(key: keyof GuestCounts, delta: number, min: number) {
    setGuests((prev) => ({ ...prev, [key]: Math.max(min, prev[key] + delta) }))
  }

  return (
    <div className="relative" ref={containerRef}>
      <input type="hidden" name="adults" value={guests.adults} />
      <input type="hidden" name="children" value={guests.children} />
      <input type="hidden" name="infants" value={guests.infants} />
      <input type="hidden" name="pets" value={guests.pets} />

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left rounded-xl border border-stone/25 bg-white px-3 py-2.5 text-sm text-navy-deep truncate focus:outline-none focus:ring-2 focus:ring-gold/50"
      >
        {guestsSummary(guests)}
      </button>

      {open && (
        <div className="absolute z-20 mt-2 left-0 w-72 max-w-[85vw] rounded-2xl border border-stone/10 bg-white shadow-xl shadow-navy-deep/10 p-4 space-y-4">
          <Counter
            label="Adultos"
            hint="13+ años"
            value={guests.adults}
            min={1}
            onDecrease={() => update('adults', -1, 1)}
            onIncrease={() => update('adults', 1, 1)}
          />
          <Counter
            label="Niños"
            hint="3–12 años"
            value={guests.children}
            min={0}
            onDecrease={() => update('children', -1, 0)}
            onIncrease={() => update('children', 1, 0)}
          />
          <Counter
            label="Infantes"
            hint="menores de 3"
            value={guests.infants}
            min={0}
            onDecrease={() => update('infants', -1, 0)}
            onIncrease={() => update('infants', 1, 0)}
          />
          <Counter
            label="Mascotas"
            hint=""
            value={guests.pets}
            min={0}
            onDecrease={() => update('pets', -1, 0)}
            onIncrease={() => update('pets', 1, 0)}
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full rounded-full bg-navy px-4 py-2 text-sm font-medium text-cream hover:bg-navy-deep transition"
          >
            Listo
          </button>
        </div>
      )}
    </div>
  )
}

function Counter({
  label,
  hint,
  value,
  min,
  onDecrease,
  onIncrease,
}: {
  label: string
  hint: string
  value: number
  min: number
  onDecrease: () => void
  onIncrease: () => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-navy-deep">{label}</p>
        {hint && <p className="text-xs text-stone">{hint}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onDecrease}
          disabled={value <= min}
          className="h-8 w-8 rounded-full border border-stone/40 text-navy-deep flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
        >
          −
        </button>
        <span className="w-4 text-center text-sm text-navy-deep">{value}</span>
        <button
          type="button"
          onClick={onIncrease}
          className="h-8 w-8 rounded-full border border-stone/40 text-navy-deep flex items-center justify-center"
        >
          +
        </button>
      </div>
    </div>
  )
}
