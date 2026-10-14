'use client'

import { useActionState, useState, useTransition } from 'react'
import { createStaff, updateStaff, resetStaffPassword, setStaffActive, deleteStaff } from './actions'

export type StaffView = {
  id: string
  name: string
  email: string
  active: boolean
  can_block_dates: boolean
  can_view_bookings: boolean
  can_view_guest_contact: boolean
  property_ids: string[]
}

type Property = { id: string; name: string }
type Result = { error: string | null; ok?: boolean }

const PERMISSIONS: { key: 'can_block_dates' | 'can_view_bookings' | 'can_view_guest_contact'; label: string; help: string }[] = [
  { key: 'can_block_dates', label: 'Bloquear y desbloquear fechas', help: 'Sus bloqueos se sincronizan a Airbnb.' },
  { key: 'can_view_bookings', label: 'Ver reservas', help: 'Ve las fechas y el nombre del huésped (sin montos).' },
  { key: 'can_view_guest_contact', label: 'Ver teléfono y correo del huésped', help: 'Solo aplica si puede ver reservas.' },
]

function generatePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint32Array(10)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

const inputCls =
  'w-full rounded-lg border border-stone/25 bg-white px-3 py-2 text-sm text-navy-deep focus:border-gold focus:outline-none'
const btnCls =
  'rounded-full border border-stone/25 px-3 py-1.5 text-xs font-medium text-navy-deep hover:border-gold transition disabled:opacity-40'

function PermissionAndPropertyFields({
  properties,
  defaults,
}: {
  properties: Property[]
  defaults?: Pick<StaffView, 'can_block_dates' | 'can_view_bookings' | 'can_view_guest_contact' | 'property_ids'>
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-wide text-stone mb-2">Propiedades a las que tiene acceso</legend>
        {properties.length === 0 ? (
          <p className="text-sm text-stone">Aún no tienes propiedades.</p>
        ) : (
          <div className="space-y-1.5">
            {properties.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm text-navy-deep">
                <input
                  type="checkbox"
                  name="property_ids"
                  value={p.id}
                  defaultChecked={defaults?.property_ids.includes(p.id) ?? false}
                  className="h-4 w-4 accent-[#c9a227]"
                />
                {p.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-wide text-stone mb-2">Qué puede hacer</legend>
        <div className="space-y-2">
          {PERMISSIONS.map((perm) => (
            <label key={perm.key} className="flex items-start gap-2 text-sm text-navy-deep">
              <input
                type="checkbox"
                name={perm.key}
                defaultChecked={defaults ? defaults[perm.key] : perm.key === 'can_block_dates'}
                className="mt-0.5 h-4 w-4 accent-[#c9a227]"
              />
              <span>
                {perm.label}
                <span className="block text-xs text-stone">{perm.help}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  )
}

function CreateStaffForm({ properties }: { properties: Property[] }) {
  const [password, setPassword] = useState('')
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)
  const [state, action, pending] = useActionState<Result, FormData>(async (prev, formData) => {
    setCreated(null)
    const r = await createStaff(prev, formData)
    if (r.ok) {
      setCreated({ email: String(formData.get('email') || ''), password: String(formData.get('password') || '') })
      setPassword('')
    }
    return r
  }, { error: null })

  return (
    <div className="rounded-2xl border border-stone/15 bg-white p-4 sm:p-5">
      <h2 className="font-medium text-navy-deep mb-3">Nuevo colaborador</h2>
      <form action={action} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm text-stone">
            Nombre
            <input name="name" required className={inputCls} placeholder="Ej. Juan (dueño de Pistache)" />
          </label>
          <label className="text-sm text-stone">
            Correo (con este entra)
            <input name="email" type="email" required className={inputCls} placeholder="correo@ejemplo.com" />
          </label>
          <label className="text-sm text-stone">
            Contraseña
            <div className="flex gap-2">
              <input
                name="password"
                type="text"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setPassword(generatePassword())} className={btnCls}>
                Generar
              </button>
            </div>
          </label>
        </div>
        <PermissionAndPropertyFields properties={properties} />
        <div className="flex flex-wrap items-center gap-3">
          <button
            disabled={pending}
            className="rounded-full bg-navy-deep px-5 py-2 text-sm font-medium text-cream hover:bg-navy transition disabled:opacity-50"
          >
            {pending ? 'Creando…' : 'Crear colaborador'}
          </button>
          {state.error && <p className="text-sm text-burnt-orange">{state.error}</p>}
        </div>
      </form>
      {created && (
        <div className="mt-4 rounded-xl bg-cream p-3 text-sm text-navy-deep">
          <p className="font-medium">Listo, ya puede entrar. Pásale estos datos:</p>
          <p className="mt-1 whitespace-pre-line text-stone">
            {`Entra a: https://huascaretreats.com/equipo\nCorreo: ${created.email}\nContraseña: ${created.password}`}
          </p>
          <CopyButton
            text={`Entra a: https://huascaretreats.com/equipo\nCorreo: ${created.email}\nContraseña: ${created.password}`}
            label="Copiar acceso"
          />
        </div>
      )}
    </div>
  )
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          window.prompt('Copia manualmente:', text)
        }
      }}
      className={`${btnCls} mt-2`}
    >
      {copied ? 'Copiado ✓' : label}
    </button>
  )
}

function StaffCard({ member, properties }: { member: StaffView; properties: Property[] }) {
  const [editing, setEditingState] = useState(false)
  const [state, action, saving] = useActionState<Result, FormData>(async (prev, formData) => {
    const r = await updateStaff(member.id, prev, formData)
    if (r.ok) setEditingState(false)
    return r
  }, { error: null })
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [showReset, setShowReset] = useState(false)

  const propertyNames = properties.filter((p) => member.property_ids.includes(p.id)).map((p) => p.name)
  const perms = PERMISSIONS.filter((p) => member[p.key]).map((p) => p.label)

  return (
    <div className={`rounded-2xl border border-stone/15 bg-white p-4 sm:p-5 ${member.active ? '' : 'opacity-70'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-navy-deep">
            {member.name}
            {!member.active && (
              <span className="ml-2 rounded-full bg-stone/15 px-2 py-0.5 text-[11px] font-medium text-stone">Desactivado</span>
            )}
          </p>
          <p className="text-sm text-stone">{member.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setEditingState((v) => !v)} className={btnCls}>
            {editing ? 'Cancelar' : 'Editar'}
          </button>
          <button type="button" onClick={() => setShowReset((v) => !v)} className={btnCls}>
            Cambiar contraseña
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await setStaffActive(member.id, !member.active)
                setMessage(r.error ?? (member.active ? 'Acceso desactivado.' : 'Acceso reactivado.'))
              })
            }
            className={btnCls}
          >
            {member.active ? 'Desactivar' : 'Reactivar'}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`¿Eliminar a ${member.name}? Ya no podrá entrar. Los bloqueos que hizo se quedan.`)) return
              startTransition(async () => {
                const r = await deleteStaff(member.id)
                if (r.error) setMessage(r.error)
              })
            }}
            className={`${btnCls} text-burnt-orange`}
          >
            Eliminar
          </button>
        </div>
      </div>

      {!editing && (
        <div className="mt-2 text-sm text-stone space-y-0.5">
          <p>
            <span className="text-navy-deep">Propiedades:</span> {propertyNames.length ? propertyNames.join(', ') : 'ninguna'}
          </p>
          <p>
            <span className="text-navy-deep">Puede:</span> {perms.length ? perms.join(' · ') : 'solo ver el calendario'}
          </p>
        </div>
      )}

      {showReset && (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            startTransition(async () => {
              const r = await resetStaffPassword(member.id, newPassword)
              if (r.error) setMessage(r.error)
              else {
                setMessage(`Contraseña nueva guardada: ${newPassword}`)
                setShowReset(false)
              }
            })
          }}
        >
          <input
            type="text"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
            placeholder="Nueva contraseña (mín. 8)"
            className={`${inputCls} max-w-xs`}
            autoComplete="new-password"
          />
          <button type="button" onClick={() => setNewPassword(generatePassword())} className={btnCls}>
            Generar
          </button>
          <button disabled={pending} className={btnCls}>
            Guardar
          </button>
        </form>
      )}

      {editing && (
        <form action={action} className="mt-4 space-y-4">
          <label className="block text-sm text-stone max-w-sm">
            Nombre
            <input name="name" defaultValue={member.name} required className={inputCls} />
          </label>
          <PermissionAndPropertyFields properties={properties} defaults={member} />
          <div className="flex items-center gap-3">
            <button
              disabled={saving}
              className="rounded-full bg-navy-deep px-5 py-2 text-sm font-medium text-cream hover:bg-navy transition disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
            {state.error && <p className="text-sm text-burnt-orange">{state.error}</p>}
          </div>
        </form>
      )}

      {message && <p className="mt-2 text-xs text-stone">{message}</p>}
    </div>
  )
}

export default function StaffManager({ staff, properties }: { staff: StaffView[]; properties: Property[] }) {
  return (
    <div className="space-y-4">
      <CreateStaffForm properties={properties} />
      {staff.length === 0 ? (
        <p className="rounded-2xl border border-stone/15 bg-white p-6 text-sm text-stone text-center">
          Aún no has dado acceso a nadie.
        </p>
      ) : (
        staff.map((m) => <StaffCard key={m.id} member={m} properties={properties} />)
      )}
    </div>
  )
}
