'use client'

// Herramientas de una reserva por fuera, dentro del panel de información de un
// día: actualizar lo que pagó / debe el huésped y moverla a otra cabaña.
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export type StayActions = {
  updatePayment: (stayId: string, paid: number | null, balance: number | null) => Promise<{ error: string | null }>
  move: (stayId: string, targetPropertyId: string) => Promise<{ error: string | null }>
}

const field =
  'w-full rounded-lg border border-stone/25 bg-white px-3 py-1.5 text-sm text-navy-deep focus:border-gold focus:outline-none'
const btn = 'rounded-full px-3 py-1.5 text-xs font-medium transition disabled:opacity-50'

function num(v: string) {
  const t = v.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export default function StayTools({
  stay,
  targets,
  actions,
}: {
  stay: { id: string; paid: number | null; balance: number | null }
  targets: { id: string; name: string }[]
  actions: StayActions
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [paid, setPaid] = useState(stay.paid != null ? String(stay.paid) : '')
  const [balance, setBalance] = useState(stay.balance != null ? String(stay.balance) : '')
  const [target, setTarget] = useState('')

  function run(fn: () => Promise<{ error: string | null }>, ok: string) {
    setMsg(null)
    start(async () => {
      const r = await fn()
      setMsg(r.error ?? ok)
      if (!r.error) router.refresh()
    })
  }

  const paidAll = () => {
    const total = (num(paid) ?? 0) + (num(balance) ?? 0)
    setPaid(total ? String(total) : paid)
    setBalance('0')
    run(() => actions.updatePayment(stay.id, total || num(paid), 0), 'Listo: marcado como pagado completo.')
  }

  return (
    <div className="mt-3 space-y-3 border-t border-stone/15 pt-3">
      <div className="space-y-2">
        <p className="text-xs font-medium text-navy-deep">Pago del huésped</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-stone">
            Ya pagó (MXN)
            <input value={paid} onChange={(e) => setPaid(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className={field} />
          </label>
          <label className="text-xs text-stone">
            Debe (MXN)
            <input value={balance} onChange={(e) => setBalance(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className={field} />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => actions.updatePayment(stay.id, num(paid), num(balance)), 'Listo: pago actualizado.')}
            className={`${btn} bg-navy-deep text-cream hover:bg-navy`}
          >
            Guardar pago
          </button>
          <button type="button" disabled={pending} onClick={paidAll} className={`${btn} border border-emerald-400 text-emerald-700`}>
            Ya pagó todo
          </button>
        </div>
      </div>

      {targets.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-navy-deep">Mover esta reserva a otra cabaña</p>
          <div className="flex flex-wrap gap-2">
            <select value={target} onChange={(e) => setTarget(e.target.value)} className={`${field} max-w-xs`}>
              <option value="">Elige la cabaña…</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={pending || !target}
              onClick={() => {
                const name = targets.find((t) => t.id === target)?.name ?? 'la otra cabaña'
                if (!window.confirm(`¿Mover todas las noches de esta reserva a ${name}? Se liberan en la cabaña actual.`)) return
                run(() => actions.move(stay.id, target), `Listo: la reserva se movió a ${name}.`)
              }}
              className={`${btn} border border-navy-deep text-navy-deep hover:bg-white`}
            >
              Mover
            </button>
          </div>
        </div>
      )}
      {msg && <p className="text-xs text-stone">{msg}</p>}
    </div>
  )
}
