'use client'

import { useActionState, useState } from 'react'

export type RuleRecord = {
  id: string
  name: string
  min_nights: number | null
  max_nights: number | null
  price_override_mxn: number | null
  price_adjustment_pct: number | null
  extra_guest_fee_mxn: number | null
  allowed_arrival_days: number[] | null
  priority: number
  color: string | null
}

export type PropertyOption = { id: string; name: string }

const DAYS = [
  { key: '0', label: 'Dom' },
  { key: '1', label: 'Lun' },
  { key: '2', label: 'Mar' },
  { key: '3', label: 'Mié' },
  { key: '4', label: 'Jue' },
  { key: '5', label: 'Vie' },
  { key: '6', label: 'Sáb' },
]

const inputClass =
  'w-full rounded-lg border border-stone/30 bg-white px-3 py-2 text-sm text-navy-deep placeholder:text-stone/50 focus:outline-none focus:ring-2 focus:ring-gold'
const labelClass = 'block text-xs font-medium text-stone mb-1'

type Action = (prev: { error: string | null }, formData: FormData) => Promise<{ error: string | null }>

export default function RuleForm({
  action,
  rule,
  submitLabel,
  onDone,
  properties,
}: {
  action: Action
  rule?: RuleRecord
  submitLabel: string
  onDone?: () => void
  // Deja elegir de una vez en qué cabañas y fechas aplicar la regla, para no
  // tener que ir luego al calendario a seleccionar celda por celda. Se pasa
  // tanto al crear una regla nueva como al editar una existente — al editar,
  // las unidades marcadas aquí se SUMAN a las aplicaciones que ya tenga (no
  // reemplaza ni quita las existentes; para quitar una aplicación se hace
  // desde el calendario).
  properties?: PropertyOption[]
}) {
  const [state, formAction, pending] = useActionState(action, { error: null })
  const [selectedProps, setSelectedProps] = useState<Set<string>>(new Set())

  function toggleProp(id: string) {
    setSelectedProps((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllProps() {
    setSelectedProps((prev) => (prev.size === (properties?.length ?? 0) ? new Set() : new Set(properties?.map((p) => p.id))))
  }

  return (
    <form
      action={async (formData) => {
        await formAction(formData)
        onDone?.()
      }}
      className="space-y-4"
    >
      {state.error && (
        <div className="rounded-lg bg-burnt-orange/10 border border-burnt-orange/30 px-3 py-2 text-sm text-burnt-orange">
          {state.error}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="sm:col-span-2">
          <span className={labelClass}>Nombre de la regla</span>
          <input
            name="name"
            defaultValue={rule?.name}
            required
            className={inputClass}
            placeholder="Temporada alta, Puente noviembre…"
          />
        </label>

        <label>
          <span className={labelClass}>Noches mínimas</span>
          <input
            type="number"
            name="min_nights"
            defaultValue={rule?.min_nights ?? ''}
            min={1}
            className={inputClass}
            placeholder="Sin cambio"
          />
        </label>
        <label>
          <span className={labelClass}>Noches máximas</span>
          <input
            type="number"
            name="max_nights"
            defaultValue={rule?.max_nights ?? ''}
            min={1}
            className={inputClass}
            placeholder="Sin cambio"
          />
        </label>

        <label>
          <span className={labelClass}>Precio fijo por noche (MXN)</span>
          <input
            type="number"
            name="price_override_mxn"
            defaultValue={rule?.price_override_mxn ?? ''}
            min={0}
            className={inputClass}
            placeholder="Ej. 2500"
          />
        </label>
        <label>
          <span className={labelClass}>… o ajuste % sobre precio base</span>
          <input
            type="number"
            name="price_adjustment_pct"
            defaultValue={rule?.price_adjustment_pct ?? ''}
            step={1}
            className={inputClass}
            placeholder="Ej. 20 (+20%) o -15"
          />
        </label>

        <label>
          <span className={labelClass}>Costo por persona extra en esta temporada (MXN, opcional)</span>
          <input
            type="number"
            name="extra_guest_fee_mxn"
            defaultValue={rule?.extra_guest_fee_mxn ?? ''}
            min={0}
            className={inputClass}
            placeholder="Deja vacío para usar el de la propiedad"
          />
        </label>

        <label>
          <span className={labelClass}>Prioridad (mayor número gana)</span>
          <input
            type="number"
            name="priority"
            defaultValue={rule?.priority ?? 0}
            className={inputClass}
          />
        </label>
        <label>
          <span className={labelClass}>Color en el calendario</span>
          <input
            type="color"
            name="color"
            defaultValue={rule?.color ?? '#c9a24a'}
            className="h-10 w-full rounded-lg border border-stone/30"
          />
        </label>
      </div>

      <div>
        <span className={labelClass}>Días de llegada permitidos (vacío = todos)</span>
        <div className="flex gap-3 flex-wrap">
          {DAYS.map((d) => (
            <label key={d.key} className="flex items-center gap-1.5 text-xs text-navy-deep">
              <input
                type="checkbox"
                name={`arrival_${d.key}`}
                defaultChecked={rule?.allowed_arrival_days?.includes(Number(d.key)) ?? false}
                className="rounded border-stone/40"
              />
              {d.label}
            </label>
          ))}
        </div>
      </div>

      {properties && properties.length > 0 && (
        <div className="rounded-lg border border-stone/20 bg-cream/40 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className={labelClass + ' mb-0'}>
              {rule
                ? 'Aplicar esta regla también a otras unidades/fechas (opcional — se suma a lo ya aplicado; para quitar una aplicación existente usa el calendario)'
                : 'Unidades donde aplicar esta regla (opcional — si no eliges ninguna, la regla se crea y la aplicas después desde el calendario)'}
            </span>
            <button
              type="button"
              onClick={toggleAllProps}
              className="text-xs text-gold underline underline-offset-2 shrink-0"
            >
              {selectedProps.size === properties.length ? 'Ninguna' : 'Todas'}
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {properties.map((p) => (
              <label key={p.id} className="flex items-center gap-1.5 text-xs text-navy-deep">
                <input
                  type="checkbox"
                  name="property_ids"
                  value={p.id}
                  checked={selectedProps.has(p.id)}
                  onChange={() => toggleProp(p.id)}
                  className="rounded border-stone/40"
                />
                {p.name}
              </label>
            ))}
          </div>

          {selectedProps.size > 0 && (
            <div className="grid sm:grid-cols-2 gap-3 pt-1">
              <label>
                <span className={labelClass}>Desde</span>
                <input type="date" name="apply_start" required className={inputClass} />
              </label>
              <label>
                <span className={labelClass}>Hasta</span>
                <input type="date" name="apply_end" required className={inputClass} />
              </label>
            </div>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-cream hover:bg-navy-deep transition disabled:opacity-60"
      >
        {pending ? 'Guardando…' : submitLabel}
      </button>
    </form>
  )
}
