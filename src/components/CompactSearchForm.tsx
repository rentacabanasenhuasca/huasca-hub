'use client'

// Buscador compacto para la barra flotante de arriba — mismo formulario que
// el buscador grande del hero, pero chico, para que siempre esté a la mano
// mientras el huésped navega el sitio (no solo en la portada). Siempre
// manda la búsqueda a "/" (ahí vive el listado de resultados), sin
// importar desde qué página se use.
import type { GuestCounts } from '@/lib/occupancy'
import GuestPicker from '@/components/GuestPicker'
import DateRangePicker from '@/components/DateRangePicker'

export default function CompactSearchForm({
  defaultCheckin,
  defaultCheckout,
  defaultGuests,
  defaultJacuzzi,
}: {
  defaultCheckin?: string
  defaultCheckout?: string
  defaultGuests: GuestCounts
  defaultJacuzzi?: boolean
}) {
  return (
    <form
      method="get"
      action="/#resultados"
      className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-2 w-full sm:w-auto"
    >
      <div className="sm:w-64">
        <DateRangePicker defaultCheckin={defaultCheckin} defaultCheckout={defaultCheckout} size="sm" />
      </div>
      <div className="flex-1 sm:flex-none sm:w-40">
        <span className="block text-[10px] font-medium text-stone mb-0.5">Huéspedes</span>
        <GuestPicker defaultGuests={defaultGuests} />
      </div>
      {/* Filtro rápido de amenidad, al estilo de los chips de Airbnb — hoy
          solo Jacuzzi (la amenidad por la que más preguntan), pero el
          patrón (checkbox con name="jacuzzi") es fácil de repetir para
          otras amenidades si hace falta más adelante. */}
      <label className="flex items-center gap-1.5 self-center rounded-full border border-stone/25 px-3 py-1.5 text-xs text-navy-deep cursor-pointer hover:bg-cream transition has-[:checked]:border-gold has-[:checked]:bg-gold/10">
        <input
          type="checkbox"
          name="jacuzzi"
          value="1"
          defaultChecked={defaultJacuzzi}
          className="accent-gold"
        />
        🛁 Con jacuzzi
      </label>
      <button
        type="submit"
        className="rounded-full bg-gold px-4 py-1.5 text-xs font-semibold text-navy-deep hover:bg-gold-light transition shrink-0"
      >
        Buscar
      </button>
    </form>
  )
}
