'use client'

// Buscador compacto para la barra flotante de arriba — mismo formulario que
// el buscador grande del hero, pero chico, para que siempre esté a la mano
// mientras el huésped navega el sitio (no solo en la portada). Siempre
// manda la búsqueda a "/" (ahí vive el listado de resultados), sin
// importar desde qué página se use.
import { useState } from 'react'
import type { GuestCounts } from '@/lib/occupancy'
import GuestPicker from '@/components/GuestPicker'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function CompactSearchForm({
  defaultCheckin,
  defaultCheckout,
  defaultGuests,
}: {
  defaultCheckin?: string
  defaultCheckout?: string
  defaultGuests: GuestCounts
}) {
  const [checkin, setCheckin] = useState(defaultCheckin ?? '')

  return (
    <form
      method="get"
      action="/"
      className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-2 w-full sm:w-auto"
    >
      <label className="flex-1 sm:flex-none sm:w-36">
        <span className="block text-[10px] font-medium text-stone mb-0.5">Llegada</span>
        <input
          type="date"
          name="checkin"
          defaultValue={defaultCheckin}
          min={todayStr()}
          onChange={(e) => setCheckin(e.target.value)}
          required
          className="w-full rounded-lg border border-stone/25 px-2.5 py-1.5 text-xs text-navy-deep focus:outline-none focus:ring-2 focus:ring-gold/50"
        />
      </label>
      <label className="flex-1 sm:flex-none sm:w-36">
        <span className="block text-[10px] font-medium text-stone mb-0.5">Salida</span>
        <input
          type="date"
          name="checkout"
          defaultValue={defaultCheckout}
          min={checkin || todayStr()}
          required
          className="w-full rounded-lg border border-stone/25 px-2.5 py-1.5 text-xs text-navy-deep focus:outline-none focus:ring-2 focus:ring-gold/50"
        />
      </label>
      <div className="flex-1 sm:flex-none sm:w-40">
        <span className="block text-[10px] font-medium text-stone mb-0.5">Huéspedes</span>
        <GuestPicker defaultGuests={defaultGuests} />
      </div>
      <button
        type="submit"
        className="rounded-full bg-gold px-4 py-1.5 text-xs font-semibold text-navy-deep hover:bg-gold-light transition shrink-0"
      >
        Buscar
      </button>
    </form>
  )
}
