'use client'

import { useRef, useState, useTransition } from 'react'
import ConfirmSubmitButton from '@/components/ConfirmSubmitButton'
import {
  addEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  toggleEmailTemplate,
  seedDefaultEmailTemplates,
} from '../email-actions'
import { EMAIL_PLACEHOLDERS } from '@/lib/email-placeholders'

export type EmailTemplateRecord = {
  id: string
  name: string
  recipient_type: 'guest' | 'admin' | 'custom'
  recipient_emails: string | null
  subject: string
  body: string
  enabled: boolean
}

const inputClass =
  'w-full rounded-lg border border-stone/30 bg-white px-3 py-2 text-sm text-navy-deep placeholder:text-stone/50 focus:outline-none focus:ring-2 focus:ring-gold'
const labelClass = 'block text-xs font-medium text-stone mb-1'

const RECIPIENT_LABELS: Record<EmailTemplateRecord['recipient_type'], string> = {
  guest: 'Al huésped',
  admin: 'A mí (administrador)',
  custom: 'A otro correo',
}

type FormState = {
  name: string
  recipient_type: EmailTemplateRecord['recipient_type']
  recipient_emails: string
  subject: string
  body: string
}

const emptyForm: FormState = { name: '', recipient_type: 'guest', recipient_emails: '', subject: '', body: '' }

function EditorForm({
  initial,
  onCancel,
  onSubmit,
  isPending,
  error,
}: {
  initial: FormState
  onCancel: () => void
  onSubmit: (fd: FormData) => void
  isPending: boolean
  error: string | null
}) {
  const [form, setForm] = useState(initial)
  const subjectRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const lastFocused = useRef<'subject' | 'body'>('body')

  function insertPlaceholder(key: string) {
    const tag = `{{${key}}}`
    if (lastFocused.current === 'subject' && subjectRef.current) {
      const el = subjectRef.current
      const start = el.selectionStart ?? el.value.length
      const end = el.selectionEnd ?? el.value.length
      const next = el.value.slice(0, start) + tag + el.value.slice(end)
      setForm((f) => ({ ...f, subject: next }))
      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(start + tag.length, start + tag.length)
      })
    } else if (bodyRef.current) {
      const el = bodyRef.current
      const start = el.selectionStart ?? el.value.length
      const end = el.selectionEnd ?? el.value.length
      const next = el.value.slice(0, start) + tag + el.value.slice(end)
      setForm((f) => ({ ...f, body: next }))
      requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(start + tag.length, start + tag.length)
      })
    }
  }

  function handleSubmit() {
    const fd = new FormData()
    fd.set('name', form.name)
    fd.set('recipient_type', form.recipient_type)
    fd.set('recipient_emails', form.recipient_emails)
    fd.set('subject', form.subject)
    fd.set('body', form.body)
    onSubmit(fd)
  }

  return (
    <div className="space-y-3 rounded-lg border border-stone/15 p-4 bg-cream/40">
      <label>
        <span className={labelClass}>Nombre de este correo (solo para identificarlo aquí)</span>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Confirmación para el huésped"
          className={inputClass}
        />
      </label>

      <label>
        <span className={labelClass}>¿A quién se le manda?</span>
        <select
          value={form.recipient_type}
          onChange={(e) => setForm({ ...form, recipient_type: e.target.value as FormState['recipient_type'] })}
          className={inputClass}
        >
          <option value="guest">Al huésped que reservó</option>
          <option value="admin">A mí (tu correo de administrador)</option>
          <option value="custom">A otro correo (ej. limpieza, mantenimiento)</option>
        </select>
      </label>

      {form.recipient_type === 'custom' && (
        <label>
          <span className={labelClass}>Correo(s) destinatario — separados por coma si son varios</span>
          <input
            value={form.recipient_emails}
            onChange={(e) => setForm({ ...form, recipient_emails: e.target.value })}
            placeholder="limpieza@huascaretreats.com, mantenimiento@huascaretreats.com"
            className={inputClass}
          />
        </label>
      )}

      <label>
        <span className={labelClass}>Asunto</span>
        <input
          ref={subjectRef}
          onFocus={() => (lastFocused.current = 'subject')}
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          placeholder="Tu reserva en {{property_name}} está confirmada"
          className={inputClass}
        />
      </label>

      <label>
        <span className={labelClass}>Cuerpo del correo</span>
        <textarea
          ref={bodyRef}
          onFocus={() => (lastFocused.current = 'body')}
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          rows={8}
          placeholder={'Hola {{guest_name}},\n\nTu reserva quedó confirmada...'}
          className={`${inputClass} font-mono text-xs`}
        />
      </label>

      <div>
        <span className={labelClass}>Insertar dato de la reserva (clic para agregarlo donde tengas el cursor)</span>
        <div className="flex flex-wrap gap-1.5">
          {EMAIL_PLACEHOLDERS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => insertPlaceholder(p.key)}
              title={p.label}
              className="rounded-full border border-stone/25 bg-white px-2.5 py-1 text-[11px] text-navy-deep hover:border-gold hover:bg-gold/10 transition"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-burnt-orange">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-cream hover:bg-navy-deep transition disabled:opacity-60"
        >
          {isPending ? 'Guardando…' : 'Guardar correo'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-stone hover:text-navy-deep">
          Cancelar
        </button>
      </div>
    </div>
  )
}

export default function EmailTemplates({
  propertyId,
  templates,
}: {
  propertyId: string
  templates: EmailTemplateRecord[]
}) {
  const [isPending, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleAdd(fd: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await addEmailTemplate(propertyId, fd)
      if (res?.error) setError(res.error)
      else setAdding(false)
    })
  }

  function handleUpdate(templateId: string, fd: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await updateEmailTemplate(propertyId, templateId, fd)
      if (res?.error) setError(res.error)
      else setEditingId(null)
    })
  }

  function handleSeed() {
    setError(null)
    startTransition(async () => {
      const res = await seedDefaultEmailTemplates(propertyId)
      if (res?.error) setError(res.error)
    })
  }

  return (
    <div className="rounded-xl border border-stone/15 bg-white p-5 space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-navy-deep uppercase tracking-wide mb-1">
          Correos de esta reserva
        </h2>
        <p className="text-xs text-stone">
          Define qué correos se mandan solos cuando alguien reserva y paga esta cabaña — al huésped, a ti, o a
          quien tú quieras. Cada uno con su propio asunto y contenido, armado con los datos de la reserva.
        </p>
      </div>

      {error && !adding && !editingId && <p className="text-sm text-burnt-orange">{error}</p>}

      {templates.length === 0 && !adding && (
        <div className="rounded-lg border border-dashed border-stone/25 p-4 text-center">
          <p className="text-sm text-stone mb-3">Todavía no configuras ningún correo para esta cabaña.</p>
          <button
            type="button"
            onClick={handleSeed}
            disabled={isPending}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-cream hover:bg-navy-deep transition disabled:opacity-60"
          >
            Empezar con correos sugeridos (huésped + administrador)
          </button>
        </div>
      )}

      {templates.length > 0 && (
        <div className="space-y-2">
          {templates.map((t) =>
            editingId === t.id ? (
              <EditorForm
                key={t.id}
                initial={{
                  name: t.name,
                  recipient_type: t.recipient_type,
                  recipient_emails: t.recipient_emails ?? '',
                  subject: t.subject,
                  body: t.body,
                }}
                onCancel={() => setEditingId(null)}
                onSubmit={(fd) => handleUpdate(t.id, fd)}
                isPending={isPending}
                error={error}
              />
            ) : (
              <div key={t.id} className="rounded-lg border border-stone/15 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy-deep truncate">{t.name}</p>
                    <p className="text-xs text-stone truncate">
                      {RECIPIENT_LABELS[t.recipient_type]}
                      {t.recipient_type === 'custom' && t.recipient_emails ? `: ${t.recipient_emails}` : ''} ·{' '}
                      {t.subject}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        startTransition(() => {
                          toggleEmailTemplate(propertyId, t.id, !t.enabled)
                        })
                      }
                      className={t.enabled ? 'text-olive-deep' : 'text-stone'}
                    >
                      {t.enabled ? 'Activo' : 'Pausado'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null)
                        setEditingId(t.id)
                      }}
                      className="text-gold underline underline-offset-2"
                    >
                      Editar
                    </button>
                    <form action={deleteEmailTemplate.bind(null, propertyId, t.id)}>
                      <ConfirmSubmitButton
                        confirmMessage={`¿Borrar el correo "${t.name}"?`}
                        className="text-burnt-orange hover:underline"
                      >
                        Borrar
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {adding ? (
        <EditorForm initial={emptyForm} onCancel={() => setAdding(false)} onSubmit={handleAdd} isPending={isPending} error={error} />
      ) : (
        templates.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setError(null)
              setAdding(true)
            }}
            className="text-sm font-medium text-gold underline underline-offset-2"
          >
            + Agregar otro correo
          </button>
        )
      )}
    </div>
  )
}
