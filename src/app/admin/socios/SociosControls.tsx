'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { approvePartnerProperty, markPartnerPayout, setPartnerAccountStatus, verifyPartnerBank } from './actions'

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
