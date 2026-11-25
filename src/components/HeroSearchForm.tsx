'use client'

// Buscador grande de la portada (diseño 2026): una barra ancha sobre la foto
// del hero. Manda exactamente los mismos parámetros que el buscador
// compacto (fechas, huéspedes, jacuzzi, tipo), así que el listado de
// resultados no cambia.
import type { GuestCounts } from '@/lib/occupancy'
import GuestPicker from '@/components/GuestPicker'
import DateRangePicker from '@/components/DateRangePicker'

export default function HeroSearchForm({
  defaultCheckin,
  defaultCheckout,
  defaultGuests,
  defaultJacuzzi,
  defaultTipo = '',
  action = '/#resultados',
}: {
  defaultCheckin?: string
  defaultCheckout?: string
  defaultGuests: GuestCounts
  defaultJacuzzi?: boolean
  defaultTipo?: string
  action?: string
}) {
  return (
    <form
      id="buscar"
      method="get"
      action={action}
      className="scroll-mt-28 grid gap-3 rounded-xl bg-[#f8f6f1]/95 p-4 text-navy-deep shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_auto_auto_auto] md:items-end md:gap-4 md:p-5"
    >
      <DateRangePicker defaultCheckin={defaultCheckin} defaultCheckout={defaultCheckout} />
      <div>
        <span className="mb-1 block text-xs font-medium text-stone">Huéspedes</span>
        <GuestPicker defaultGuests={defaultGuests} />
      </div>
      <div className="flex flex-wrap gap-2 md:contents">
        <label className="flex h-[42px] cursor-pointer items-center gap-2 rounded-full border border-stone/30 px-4 text-sm font-semibold text-navy-deep transition hover:border-navy-deep has-[:checked]:border-gold has-[:checked]:bg-gold/15">
          <input type="checkbox" name="jacuzzi" value="1" defaultChecked={defaultJacuzzi} className="accent-gold" />
          Con jacuzzi
        </label>
        <label className="flex h-[42px] items-center">
          <span className="sr-only">Tipo de propiedad</span>
          <select
            name="tipo"
            defaultValue={defaultTipo}
            className="h-[42px] rounded-full border border-stone/30 bg-transparent px-4 text-sm font-semibold text-navy-deep focus:border-gold focus:outline-none"
          >
            <option value="">Todos los tipos</option>
            <option value="accesible">Accesible</option>
            <option value="media">Media</option>
            <option value="premium">Premium</option>
          </select>
        </label>
      </div>
      <button
        type="submit"
        className="h-12 rounded-lg bg-gold px-8 text-base font-semibold text-navy-deep transition hover:bg-gold-light md:h-[42px]"
      >
        Buscar
      </button>
    </form>
  )
}
