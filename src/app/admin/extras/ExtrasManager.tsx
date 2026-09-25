'use client'

import { useState } from 'react'
import ExtraForm, { type AddonRecord, type PropertyOption } from './ExtraForm'
import { createAddon, updateAddon, deleteAddon, toggleAddonActive } from './actions'
import ConfirmSubmitButton from '@/components/ConfirmSubmitButton'

export default function ExtrasManager({
  addons,
  properties,
}: {
  addons: AddonRecord[]
  properties: PropertyOption[]
}) {
  const [showNew, setShowNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-stone/15 bg-white p-5">
        {showNew ? (
          <>
            <h2 className="text-sm font-semibold text-navy-deep mb-4 uppercase tracking-wide">
              Nuevo extra
            </h2>
            <ExtraForm
              action={createAddon}
              submitLabel="Crear extra"
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
            + Nuevo extra
          </button>
        )}
      </div>

      {addons.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone/30 bg-white p-8 text-center text-stone text-sm">
          Aún no tienes extras. Crea uno para que tus huéspedes puedan agregarlo al reservar.
        </div>
      ) : (
        <div className="space-y-3">
          {addons.map((addon) => (
            <div key={addon.id} className="rounded-xl border border-stone/15 bg-white p-4">
              {editingId === addon.id ? (
                <>
                  <ExtraForm
                    action={updateAddon.bind(null, addon.id)}
                    addon={addon}
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
                  <div className="flex items-center gap-3 min-w-0">
                    {addon.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={addon.photo_url} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-cream shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-navy-deep truncate">
                        {addon.name} {!addon.active && <span className="text-stone">(oculto)</span>}
                      </p>
                      <p className="text-xs text-stone">
                        ${Number(addon.price_mxn).toLocaleString('es-MX')} MXN
                        {addon.unit === 'per_unit' ? ` · hasta ${addon.max_quantity}` : ' · único'}
                        {addon.property_ids.length > 0
                          ? ` · solo en ${addon.property_ids.length} ${addon.property_ids.length === 1 ? 'unidad' : 'unidades'}`
                          : ' · todas las unidades'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm shrink-0">
                    <form action={toggleAddonActive.bind(null, addon.id, !addon.active)}>
                      <button type="submit" className="text-gold underline underline-offset-2">
                        {addon.active ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </form>
                    <button
                      type="button"
                      onClick={() => setEditingId(addon.id)}
                      className="text-gold underline underline-offset-2"
                    >
                      Editar
                    </button>
                    <form action={deleteAddon.bind(null, addon.id)}>
                      <ConfirmSubmitButton
                        confirmMessage={`¿Eliminar el extra "${addon.name}"?`}
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
