'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setPartnerPropertyState } from '../../actions'

export default function StateButtons({ propertyId, state }: { propertyId: string; state: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  function run(next: 'paused' | 'active' | 'removed', confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return
    setMsg(null)
    start(async () => {
      const r = await setPartnerPropertyState(propertyId, next)
      if (r.error) setMsg(r.error)
      else router.refresh()
    })
  }

  const btn = 'rounded-lg border px-3 py-1.5 text-xs disabled:opacity-50'
  return (
    <>
      {state === 'active' && (
        <button disabled={pending} onClick={() => run('paused')} className={`${btn} border-stone/25 text-stone hover:border-gold`}>
          Pausar
        </button>
      )}
      {state === 'paused' && (
        <button disabled={pending} onClick={() => run('active')} className={`${btn} border-emerald-300 text-emerald-700`}>
          Reactivar
        </button>
      )}
      {state !== 'removed' && (
        <button
          disabled={pending}
          onClick={() => run('removed', '¿Quitar tu cabaña de la plataforma? Dejará de aparecer en el sitio. Para volver a publicarla tendrás que escribirnos.')}
          className={`${btn} border-burnt-orange/30 text-burnt-orange`}
        >
          Quitar de la plataforma
        </button>
      )}
      {msg && <p className="w-full text-xs text-burnt-orange">{msg}</p>}
    </>
  )
}
