'use client'

import { useActionState } from 'react'

type Result = { error: string | null }
const input =
  'w-full rounded-lg border border-stone/30 bg-white px-3 py-2 text-sm text-navy-deep placeholder:text-stone/50 focus:outline-none focus:ring-2 focus:ring-gold'
const label = 'block text-xs font-medium text-stone mb-1'

export default function RegistroForm({ action }: { action: (prev: Result, formData: FormData) => Promise<Result> }) {
  const [state, formAction, pending] = useActionState(action, { error: null })
  return (
    <form action={formAction} className="rounded-2xl border border-stone/15 bg-white p-5 space-y-4">
      <div>
        <label className={label}>Tu nombre completo *</label>
        <input name="name" required className={input} autoComplete="name" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={label}>Correo *</label>
          <input name="email" type="email" required className={input} autoComplete="email" />
        </div>
        <div>
          <label className={label}>WhatsApp *</label>
          <input name="phone" type="tel" required className={input} autoComplete="tel" placeholder="55 1234 5678" />
        </div>
      </div>
      <div>
        <label className={label}>Crea una contraseña (mínimo 8 caracteres) *</label>
        <input name="password" type="password" minLength={8} required className={input} autoComplete="new-password" />
      </div>
      <label className="flex items-start gap-2 text-xs text-navy-deep">
        <input type="checkbox" name="terms" required className="mt-0.5" />
        <span>
          Leí y acepto los{' '}
          <a href="/socios/terminos" target="_blank" className="underline underline-offset-2">
            términos para socios
          </a>
          , incluyendo que debo mantener mi calendario al día y que cancelar una reserva confirmada puede tener penalización.
        </span>
      </label>
      {state.error && <p className="rounded-lg bg-burnt-orange/10 px-3 py-2 text-sm text-burnt-orange">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-full bg-navy-deep px-6 py-2.5 text-sm font-medium text-cream disabled:opacity-50">
        {pending ? 'Creando cuenta…' : 'Crear mi cuenta de socio'}
      </button>
    </form>
  )
}
