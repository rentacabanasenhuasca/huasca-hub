'use client'

import { useActionState, useState } from 'react'

export type DiscountCodeRecord = {
  id: string
  code: string
  description: string | null
  discount_type: 'percent' | 'fixed'
  discount_value: number
  valid_from: string | null
  valid_until: string | null
  min_nights: number | null
  max_uses: number | null
  times_used: number
  active: boolean
  property_ids: string[]
}

export type PropertyOption = { id: string; name: string }

const inputClass =
  'w-full rounded-lg border border-stone/30 bg-white px-3 py-2 text-sm text-navy-deep placeholder:text-stone/50 focus:outline-none focus:ring-2 focus:ring-gold'
const labelClass = 'block text-xs font-medium text-stone mb-1'

type Action = (prev: { error: string | null }, formData: FormData) => Promise<{ error: string | null }>

export default function CuponForm({
  action,
  discount,
  submitLabel,
  onDone,
  properties,
}: {
  action: Action
  discount?: DiscountCodeRecord
  submitLabel: string
  onDone?: () => void
  properties: PropertyOption[]
}) {
  const [state, formAction, pending] = useActionState(action, { error: null })
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>(discount?.discount_type ?? 'percent')
  const [selectedProps, setSelectedProps] = useState<Set<string>>(new Set(discount?.property_ids ?? []))

  function toggleProp(id: string) {
    setSelectedProps((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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
        <label>
          <span className={labelClass}>Código</span>
          <input
            name="code"
            defaultValue={discount?.code}
            required
            className={inputClass + ' uppercase'}
            placeholder="VERANO2026"
          />
        </label>

        <label>
          <span className={labelClass}>Orden/notas (opcional)</span>
          <input
            name="description"
            defaultValue={discount?.description ?? ''}
            className={inputClass}
            placeholder="Promo redes sociales, cliente frecuente…"
          />
        </label>

        <label>
          <span className={labelClass}>Tipo de descuento</span>
          <select
            name="discount_type"
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed')}
            className={inputClass}
          >
            <option value="percent">Porcentaje (%)</option>
            <option value="fixed">Monto fijo (MXN)</option>
          </select>
        </label>

        <label>
          <span className={labelClass}>{discountType === 'percent' ? 'Porcentaje de descuento' : 'Monto a descontar (MXN)'}</span>
          <input
            type="number"
            name="discount_value"
            defaultValue={discount?.discount_value ?? ''}
            min={0}
            max={discountType === 'percent' ? 100 : undefined}
            step={discountType === 'percent' ? 1 : 0.01}
            required
            className={inputClass}
          />
        </label>

        <label>
          <span className={labelClass}>Vigente desde (opcional)</span>
          <input type="date" name="valid_from" defaultValue={discount?.valid_from ?? ''} className={inputClass} />
        </label>

        <label>
          <span className={labelClass}>Vigente hasta (opcional)</span>
          <input type="date" name="valid_until" defaultValue={discount?.valid_until ?? ''} className={inputClass} />
        </label>

        <label>
          <span className={labelClass}>Mínimo de noches (opcional)</span>
          <input
            type="number"
            name="min_nights"
            defaultValue={discount?.min_nights ?? ''}
            min={1}
            className={inputClass}
            placeholder="Sin mínimo adicional"
          />
        </label>

        <label>
          <span className={labelClass}>Límite de usos totales (opcional)</span>
          <input
            type="number"
            name="max_uses"
            defaultValue={discount?.max_uses ?? ''}
            min={1}
            className={inputClass}
            placeholder="Ilimitado"
          />
        </label>
      </div>

      <p className="text-xs text-stone">
        La vigencia se compara contra la fecha de check-in de la reserva — así puedes vender la promo con
        anticipación y sigue aplicando el día de la estancia.
      </p>

      <label className="flex items-center gap-2 text-sm text-navy-deep">
        <input type="checkbox" name="active" defaultChecked={discount?.active ?? true} className="rounded border-stone/40" />
        Activo (los huéspedes pueden usarlo en el checkout)
      </label>

      {properties.length > 0 && (
        <div className="rounded-lg border border-stone/20 bg-cream/40 p-3 space-y-2">
          <span className={labelClass + ' mb-0'}>Unidades donde aplica (vacío = todas tus cabañas)</span>
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
