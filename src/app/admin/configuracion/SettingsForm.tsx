'use client'

import { useActionState } from 'react'
import { updateHostSettings } from './actions'

const inputClass =
  'w-full rounded-lg border border-stone/30 bg-white px-3 py-2 text-sm text-navy-deep placeholder:text-stone/50 focus:outline-none focus:ring-2 focus:ring-gold'
const labelClass = 'block text-xs font-medium text-stone mb-1'

export default function SettingsForm({
  name,
  phone,
  email,
}: {
  name: string
  phone: string | null
  email: string
}) {
  const [state, formAction, pending] = useActionState(updateHostSettings, { error: null })

  return (
    <form action={formAction} className="rounded-xl border border-stone/15 bg-white p-5 space-y-4 max-w-lg">
      {state.error && (
        <div className="rounded-lg bg-burnt-orange/10 border border-burnt-orange/30 px-4 py-3 text-sm text-burnt-orange">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="rounded-lg bg-olive-deep/10 border border-olive-deep/30 px-4 py-3 text-sm text-olive-deep">
          Guardado.
        </div>
      )}

      <label>
        <span className={labelClass}>Nombre del anfitrión / negocio</span>
        <input name="name" defaultValue={name} required className={inputClass} placeholder="Huasca Retreats" />
      </label>

      <label>
        <span className={labelClass}>Número de WhatsApp (con código de país, sin espacios ni +)</span>
        <input
          name="phone"
          defaultValue={phone ?? ''}
          className={inputClass}
          placeholder="5215527327670"
        />
        <p className="text-xs text-stone mt-1">
          Ejemplo para México: 52 + 1 + tu número a 10 dígitos. Este es el número que usan el botón
          flotante de WhatsApp del sitio y el botón de &ldquo;Preguntar por WhatsApp&rdquo; en cada cabaña.
        </p>
      </label>

      <label>
        <span className={labelClass}>Correo de contacto</span>
        <input name="email" type="email" defaultValue={email} required className={inputClass} />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-navy px-6 py-2.5 text-sm font-medium text-cream hover:bg-navy-deep transition disabled:opacity-60"
      >
        {pending ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  )
}
