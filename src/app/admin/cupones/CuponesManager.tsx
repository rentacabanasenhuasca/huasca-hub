'use client'

import { useState } from 'react'
import CuponForm, { type DiscountCodeRecord, type PropertyOption } from './CuponForm'
import { createDiscountCode, updateDiscountCode, deleteDiscountCode, toggleDiscountActive } from './actions'
import ConfirmSubmitButton from '@/components/ConfirmSubmitButton'

function formatValue(discount: DiscountCodeRecord) {
  return discount.discount_type === 'percent'
    ? `${discount.discount_value}%`
    : `$${Number(discount.discount_value).toLocaleString('es-MX')} MXN`
}

function formatVigencia(discount: DiscountCodeRecord) {
  if (!discount.valid_from && !discount.valid_until) return 'Sin fecha límite'
  if (discount.valid_from && discount.valid_until) return `${discount.valid_from} → ${discount.valid_until}`
  if (discount.valid_from) return `Desde ${discount.valid_from}`
  return `Hasta ${discount.valid_until}`
}

export default function CuponesManager({
  discounts,
  properties,
}: {
  discounts: DiscountCodeRecord[]
  properties: PropertyOption[]
}) {
  const [showNew, setShowNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-stone/15 bg-white p-5">
        {showNew ? (
          <>
            <h2 className="text-sm font-semibold text-navy-deep mb-4 uppercase tracking-wide">Nuevo cupón</h2>
            <CuponForm
              action={createDiscountCode}
              submitLabel="Crear cupón"
              onDone={() => setShowNew(false)}
              properties={properties}
            />
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className="mt-3 text-sm text-stone hover:text-navy-deep"
            >
              Cancelar
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="text-sm font-medium text-gold underline underline-offset-2"
          >
            + Nuevo cupón
          </button>
        )}
      </div>

      {discounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone/30 bg-white p-8 text-center text-stone text-sm">
          Aún no tienes cupones. Crea uno para ofrecer descuentos en el checkout.
        </div>
      ) : (
        <div className="space-y-3">
          {discounts.map((discount) => (
            <div key={discount.id} className="rounded-xl border border-stone/15 bg-white p-4">
              {editingId === discount.id ? (
                <>
                  <CuponForm
                    action={updateDiscountCode.bind(null, discount.id)}
                    discount={discount}
                    submitLabel="Guardar cambios"
                    onDone={() => setEditingId(null)}
                    properties={properties}
                  />
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="mt-3 text-sm text-stone hover:text-navy-deep"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy-deep truncate">
                      {discount.code} — {formatValue(discount)}{' '}
                      {!discount.active && <span className="text-stone">(inactivo)</span>}
                    </p>
                    <p className="text-xs text-stone mt-0.5">
                      {formatVigencia(discount)}
                      {discount.min_nights ? ` · mín. ${discount.min_nights} noches` : ''}
                      {' · '}
                      {discount.times_used} {discount.times_used === 1 ? 'uso' : 'usos'}
                      {discount.max_uses ? ` de ${discount.max_uses}` : ''}
                      {discount.property_ids.length > 0
                        ? ` · solo en ${discount.property_ids.length} ${discount.property_ids.length === 1 ? 'unidad' : 'unidades'}`
                        : ' · todas las unidades'}
                    </p>
                    {discount.description && <p className="text-xs text-stone mt-0.5">{discount.description}</p>}
                  </div>
                  <div className="flex items-center gap-3 text-sm shrink-0">
                    <form action={toggleDiscountActive.bind(null, discount.id, !discount.active)}>
                      <button type="submit" className="text-gold underline underline-offset-2">
                        {discount.active ? 'Desactivar' : 'Activar'}
                      </button>
                    </form>
                    <button
                      type="button"
                      onClick={() => setEditingId(discount.id)}
                      className="text-gold underline underline-offset-2"
                    >
                      Editar
                    </button>
                    <form action={deleteDiscountCode.bind(null, discount.id)}>
                      <ConfirmSubmitButton
                        confirmMessage={`¿Eliminar el cupón "${discount.code}"?`}
                        className="text-burnt-orange hover:underline"
                      >
                        Eliminar
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
