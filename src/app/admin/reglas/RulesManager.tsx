'use client'

import { useState } from 'react'
import RuleForm, { type RuleRecord, type PropertyOption } from './RuleForm'
import { createRule, updateRule, deleteRule } from './actions'
import ConfirmSubmitButton from '@/components/ConfirmSubmitButton'

export default function RulesManager({ rules, properties }: { rules: RuleRecord[]; properties: PropertyOption[] }) {
  const [showNew, setShowNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-stone/15 bg-white p-5">
        {showNew ? (
          <>
            <h2 className="text-sm font-semibold text-navy-deep mb-4 uppercase tracking-wide">
              Nueva regla
            </h2>
            <RuleForm
              action={createRule}
              submitLabel="Crear regla"
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
            + Nueva regla de precio
          </button>
        )}
      </div>

      {rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone/30 bg-white p-8 text-center text-stone text-sm">
          Aún no tienes reglas de precio. Crea una para poder aplicarla desde el calendario.
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className="rounded-xl border border-stone/15 bg-white p-4">
              {editingId === rule.id ? (
                <>
                  <RuleForm
                    action={updateRule.bind(null, rule.id)}
                    rule={rule}
                    submitLabel="Guardar cambios"
                    onDone={() => setEditingId(null)}
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
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: rule.color ?? '#c9a24a' }}
                    />
                    <div>
                      <p className="text-sm font-medium text-navy-deep">{rule.name}</p>
                      <p className="text-xs text-stone">
                        {ruleSummary(rule)} · prioridad {rule.priority}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => setEditingId(rule.id)}
                      className="text-gold underline underline-offset-2"
                    >
                      Editar
                    </button>
                    <form action={deleteRule.bind(null, rule.id)}>
                      <ConfirmSubmitButton
                        confirmMessage={`¿Eliminar la regla "${rule.name}"? Se quitará de cualquier fecha donde esté aplicada.`}
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

function ruleSummary(rule: RuleRecord) {
  const parts: string[] = []
  if (rule.price_override_mxn != null) parts.push(`$${Number(rule.price_override_mxn).toLocaleString('es-MX')}/noche`)
  else if (rule.price_adjustment_pct != null) parts.push(`${rule.price_adjustment_pct > 0 ? '+' : ''}${rule.price_adjustment_pct}% precio`)
  if (rule.extra_guest_fee_mxn != null) parts.push(`$${Number(rule.extra_guest_fee_mxn).toLocaleString('es-MX')}/persona extra`)
  if (rule.min_nights) parts.push(`mín. ${rule.min_nights} noches`)
  if (rule.max_nights) parts.push(`máx. ${rule.max_nights} noches`)
  return parts.length > 0 ? parts.join(' · ') : 'Sin cambios de precio'
}
