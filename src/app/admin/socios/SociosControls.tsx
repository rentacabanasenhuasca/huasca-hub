'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { approvePartnerProperty, deletePartner, markPartnerPayout, setPartnerAccountStatus, setPartnerPricing, verifyPartnerBank } from './actions'

function useAction() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  function run(fn: () => Promise<{ error: string | null }>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return
    setMsg(null)
    start(async () => {
      const r = await fn()
      if (r.error) setMsg(r.error)
      else router.refresh()
    })
  }
  return { pending, msg, run }
}

const btn = 'rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50'

export function ApproveButton({ propertyId }: { propertyId: string }) {
  const { pending, msg, run } = useAction()
  return (
    <span>
      <button
        disabled={pending}
        onClick={() => run(() => approvePartnerProperty(propertyId), '¿Aprobar y publicar esta cabaña en el sitio?')}
        className={`${btn} bg-navy-deep text-cream`}
      >
        Aprobar y publicar
      </button>
      {msg && <span className="ml-2 text-xs text-burnt-orange">{msg}</span>}
    </span>
  )
}

export function VerifyBankButton({ partnerId, verified }: { partnerId: string; verified: boolean }) {
  const { pending, msg, run } = useAction()
  return (
    <span>
      <button
        disabled={pending}
        onClick={() =>
          run(
            () => verifyPartnerBank(partnerId, !verified),
            verified ? '¿Quitar la verificación de esta cuenta?' : '¿Confirmas que el titular y la CLABE coinciden con el comprobante?'
          )
        }
        className={`${btn} ${verified ? 'border border-stone/25 text-stone' : 'bg-emerald-600 text-white'}`}
      >
        {verified ? 'Quitar verificación' : 'Marcar cuenta verificada'}
      </button>
      {msg && <span className="ml-2 text-xs text-burnt-orange">{msg}</span>}
    </span>
  )
}

export function AccountStatusButton({ partnerId, status }: { partnerId: string; status: string }) {
  const { pending, msg, run } = useAction()
  const suspend = status === 'active'
  return (
    <span>
      <button
        disabled={pending}
        onClick={() =>
          run(
            () => setPartnerAccountStatus(partnerId, suspend ? 'suspended' : 'active'),
            suspend ? '¿Suspender a este socio? Sus cabañas dejan de aparecer y no podrá entrar a su panel.' : '¿Reactivar a este socio?'
          )
        }
        className={`${btn} border ${suspend ? 'border-burnt-orange/30 text-burnt-orange' : 'border-emerald-300 text-emerald-700'}`}
      >
        {suspend ? 'Suspender' : 'Reactivar'}
      </button>
      {msg && <span className="ml-2 text-xs text-burnt-orange">{msg}</span>}
    </span>
  )
}

export function DeletePartnerButton({ partnerId, name }: { partnerId: string; name: string }) {
  const { pending, msg, run } = useAction()
  return (
    <span>
      <button
        disabled={pending}
        onClick={() =>
          run(
            () => deletePartner(partnerId),
            `¿Borrar a ${name} por completo? Se borra su cuenta, el acceso de su equipo y sus documentos, y sus cabañas salen del sitio. Esto no se puede deshacer.`
          )
        }
        className={`${btn} border border-burnt-orange/40 bg-burnt-orange/10 text-burnt-orange`}
      >
        Borrar socio
      </button>
      {msg && <span className="ml-2 text-xs text-burnt-orange">{msg}</span>}
    </span>
  )
}

export function PayoutButton({ bookingId, paid, amount }: { bookingId: string; paid: boolean; amount: string }) {
  const { pending, msg, run } = useAction()
  const [ref, setRef] = useState('')
  if (paid) {
    return (
      <button
        disabled={pending}
        onClick={() => run(() => markPartnerPayout(bookingId, false, ''), '¿Marcar este pago como NO pagado?')}
        className="text-xs text-stone underline underline-offset-2"
      >
        Deshacer
      </button>
    )
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <input
        value={ref}
        onChange={(e) => setRef(e.target.value)}
        placeholder="Clave de rastreo (opcional)"
        className="w-40 rounded-lg border border-stone/30 px-2 py-1 text-xs"
      />
      <button
        disabled={pending}
        onClick={() => run(() => markPartnerPayout(bookingId, true, ref), `¿Ya transferiste ${amount}? Se le avisará al socio por correo.`)}
        className={`${btn} bg-emerald-600 text-white`}
      >
        Marcar pagado
      </button>
      {msg && <span className="text-xs text-burnt-orange">{msg}</span>}
    </span>
  )
}

// Precio al huésped (con tu margen), calificación y tipo de una cabaña de
// socio. El socio no ve nada de esto.
export function PartnerPricingRow({
  propertyId,
  name,
  partnerName,
  state,
  partnerWeekday,
  partnerWeekend,
  feePct,
  markupPct,
  rating,
  tier,
}: {
  propertyId: string
  name: string
  partnerName: string
  state: string
  partnerWeekday: number
  partnerWeekend: number
  feePct: number
  markupPct: number
  rating: number | null
  tier: string | null
}) {
  const { pending, msg, run } = useAction()
  const [markup, setMarkup] = useState(String(markupPct))
  const [rate, setRate] = useState(rating != null ? String(rating) : '')
  const [kind, setKind] = useState(tier ?? '')
  const [saved, setSaved] = useState(false)
  const m = Number(markup) || 0
  const guest = (p: number) => Math.round((p * (1 + m / 100)) / 10) * 10
  const net = (p: number) => Math.round(p * (1 - feePct / 100))
  const money = (n: number) => `$${n.toLocaleString('es-MX')}`
  const field = 'rounded-lg border border-stone/25 bg-white px-2 py-1.5 text-sm text-navy-deep focus:border-gold focus:outline-none'

  return (
    <div className="border-t border-stone/10 pt-3 first:border-0 first:pt-0">
      <p className="text-sm font-medium text-navy-deep">
        {name} <span className="text-xs font-normal text-stone">· {partnerName} · {state}</span>
      </p>
      <div className="mt-1 grid gap-1 text-xs text-stone sm:grid-cols-2">
        <p>
          Entre semana: socio <strong className="text-navy-deep">{money(partnerWeekday)}</strong> → huésped{' '}
          <strong className="text-navy-deep">{money(guest(partnerWeekday))}</strong> · le pagas {money(net(partnerWeekday))} · te quedan{' '}
          <strong className="text-emerald-700">{money(guest(partnerWeekday) - net(partnerWeekday))}</strong>
        </p>
        <p>
          Fin de semana: socio <strong className="text-navy-deep">{money(partnerWeekend)}</strong> → huésped{' '}
          <strong className="text-navy-deep">{money(guest(partnerWeekend))}</strong> · le pagas {money(net(partnerWeekend))} · te quedan{' '}
          <strong className="text-emerald-700">{money(guest(partnerWeekend) - net(partnerWeekend))}</strong>
        </p>
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="text-xs text-stone">
          Tu margen al huésped (%)
          <input value={markup} onChange={(e) => { setMarkup(e.target.value.replace(/[^\d.]/g, '')); setSaved(false) }} inputMode="decimal" className={`${field} block w-24`} />
        </label>
        <label className="text-xs text-stone">
          Calificación (1-5)
          <input value={rate} onChange={(e) => { setRate(e.target.value.replace(/[^\d.]/g, '')); setSaved(false) }} inputMode="decimal" placeholder="4.8" className={`${field} block w-20`} />
        </label>
        <label className="text-xs text-stone">
          Tipo
          <select value={kind} onChange={(e) => { setKind(e.target.value); setSaved(false) }} className={`${field} block`}>
            <option value="">Sin definir</option>
            <option value="accesible">Accesible</option>
            <option value="media">Media</option>
            <option value="lujo">Premium</option>
          </select>
        </label>
        <button
          disabled={pending}
          onClick={() =>
            run(async () => {
              const r = await setPartnerPricing(propertyId, m, rate ? Number(rate) : null, kind || null)
              if (!r.error) setSaved(true)
              return r
            })
          }
          className={`${btn} bg-navy-deep text-cream`}
        >
          Guardar
        </button>
        {saved && !pending && <span className="text-xs text-emerald-700">Guardado ✓</span>}
        {msg && <span className="text-xs text-burnt-orange">{msg}</span>}
      </div>
    </div>
  )
}
