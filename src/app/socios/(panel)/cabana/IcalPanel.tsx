'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type Source = {
  id: string
  label: string
  platform: string
  last_synced_at: string | null
  last_sync_status: string | null
  // false = lo conectó el anfitrión; aquí solo se muestra.
  removable?: boolean
}
type Result = { error: string | null }

const input =
  'w-full rounded-lg border border-stone/30 bg-white px-3 py-2 text-sm text-navy-deep placeholder:text-stone/50 focus:outline-none focus:ring-2 focus:ring-gold'

export default function IcalPanel({
  propertyId,
  exportUrl,
  sources,
  addAction,
  deleteAction,
  intro,
}: {
  propertyId: string
  exportUrl: string
  sources: Source[]
  addAction: (prev: Result, formData: FormData) => Promise<Result>
  deleteAction: (propertyId: string, sourceId: string) => Promise<void>
  intro?: string
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(addAction, { error: null })
  const [deleting, startDelete] = useTransition()
  const [copied, setCopied] = useState(false)

  return (
    <section className="rounded-2xl border border-stone/15 bg-white p-5 space-y-4">
      <div>
        <h2 className="font-medium text-navy-deep">Conectar calendarios (Airbnb, Booking y otras)</h2>
        <p className="text-xs text-stone mt-1">
          {intro ??
            `Muy importante: si rentas tu cabaña por otros lados, conecta aquí su calendario para que esas fechas se bloqueen solas. Si reservas
          por WhatsApp o en persona, bloquea esas fechas en tu calendario el mismo día.`}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-navy-deep">1. Trae tus reservas de Airbnb / Booking hacia aquí</p>
        {sources.length > 0 && (
          <ul className="space-y-1.5">
            {sources.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg bg-cream/60 px-3 py-2 text-xs">
                <span>
                  <strong className="text-navy-deep">{s.label}</strong>{' '}
                  <span className="text-stone">
                    {s.last_synced_at
                      ? `· última lectura ${new Date(s.last_synced_at).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'short', timeStyle: 'short' })}`
                      : '· pendiente'}
                    {s.last_sync_status && !s.last_sync_status.startsWith('ok') ? ` · ${s.last_sync_status}` : ''}
                  </span>
                </span>
                {s.removable === false ? (
                  <span className="text-[11px] text-stone">Conectado por el anfitrión</span>
                ) : (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => {
                    if (!window.confirm(`¿Desconectar ${s.label}? Las fechas que venían de ahí se liberan.`)) return
                    startDelete(async () => {
                      await deleteAction(propertyId, s.id)
                      router.refresh()
                    })
                  }}
                  className="text-burnt-orange"
                >
                  Quitar
                </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <form action={formAction} className="grid grid-cols-1 sm:grid-cols-[160px_1fr_auto] gap-2">
          <select name="label" className={input} defaultValue="Airbnb">
            <option>Airbnb</option>
            <option>Booking</option>
            <option>Vrbo</option>
            <option>Google Calendar</option>
            <option>Otro</option>
          </select>
          <input name="url" className={input} placeholder="Pega la liga del calendario (iCal / .ics)" />
          <button disabled={pending} className="rounded-lg bg-navy-deep px-4 py-2 text-sm text-cream disabled:opacity-50">
            {pending ? 'Conectando…' : 'Conectar'}
          </button>
        </form>
        {state.error && <p className="text-xs text-burnt-orange">{state.error}</p>}
        <p className="text-[11px] text-stone">
          En Airbnb: Calendario → Disponibilidad → Conectar calendarios → Exportar calendario. En Booking: Tarifas y disponibilidad → Sincronizar
          calendarios → Exportar.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-navy-deep">2. Lleva tus reservas de Huasca Retreats hacia Airbnb / Booking</p>
        <div className="flex gap-2">
          <input readOnly value={exportUrl} className={`${input} text-xs`} onFocus={(e) => e.target.select()} />
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(exportUrl)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
            className="rounded-lg border border-stone/25 px-3 text-xs text-navy-deep"
          >
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <p className="text-[11px] text-stone">Pega esta liga en Airbnb o Booking como &quot;importar calendario&quot;.</p>
      </div>
    </section>
  )
}
