'use client'

import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn } from './actions'

const initialState = { error: null as string | null }

// Sin registro público: este panel es de un solo anfitrión (Christian). El
// registro abierto que había antes permitía que cualquier visitante creara
// su propia cuenta y entrara a /admin. Si algún día se necesita otra cuenta
// (por ejemplo un socio o un asistente), se crea manualmente desde Supabase.
export default function LoginForm() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/admin'

  const [loginState, loginAction, loginPending] = useActionState(signIn, initialState)

  const inputClass =
    'w-full rounded-lg border border-stone/30 bg-white px-3 py-2 text-sm text-navy-deep placeholder:text-stone/60 focus:outline-none focus:ring-2 focus:ring-gold'

  return (
    <form action={loginAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Correo" name="email" type="email" className={inputClass} required />
      <Field label="Contraseña" name="password" type="password" className={inputClass} required />
      {loginState.error && <p className="text-sm text-burnt-orange">{loginState.error}</p>}
      <button
        type="submit"
        disabled={loginPending}
        className="w-full rounded-lg bg-navy px-4 py-2.5 text-sm font-medium text-cream hover:bg-navy-deep transition disabled:opacity-60"
      >
        {loginPending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}

function Field({
  label,
  name,
  type,
  className,
  required,
}: {
  label: string
  name: string
  type: string
  className: string
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-stone mb-1">{label}</span>
      <input name={name} type={type} required={required} className={className} />
    </label>
  )
}
