'use client'

import { useActionState, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { uuid } from '@/lib/uuid'

type Result = { error: string | null }
const input =
  'w-full rounded-lg border border-stone/30 bg-white px-3 py-2 text-sm text-navy-deep placeholder:text-stone/50 focus:outline-none focus:ring-2 focus:ring-gold'
const label = 'block text-xs font-medium text-stone mb-1'

function clabeCheck(raw: string) {
  const c = raw.replace(/\D/g, '')
  if (c.length !== 18) return null
  const w = [3, 7, 1]
  let sum = 0
  for (let i = 0; i < 17; i++) sum += (Number(c[i]) * w[i % 3]) % 10
  return (10 - (sum % 10)) % 10 === Number(c[17])
}

export default function BankForm({
  action,
  userId,
  banks,
  initial,
  verified,
}: {
  action: (prev: Result, formData: FormData) => Promise<Result>
  userId: string
  banks: Record<string, string>
  initial: { bank_holder: string; bank_clabe: string; bank_rfc: string; bank_proof_path: string }
  verified: boolean
}) {
  const [state, formAction, pending] = useActionState(action, { error: null })
  const [clabe, setClabe] = useState(initial.bank_clabe)
  const [proof, setProof] = useState(initial.bank_proof_path)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const digits = clabe.replace(/\D/g, '')
  const valid = clabeCheck(clabe)
  const bank = useMemo(() => (digits.length >= 3 ? banks[digits.slice(0, 3)] : undefined), [digits, banks])

  async function upload(file: File | undefined) {
    if (!file) return
    setUploadError(null)
    if (file.size > 10 * 1024 * 1024) return setUploadError('El archivo pesa más de 10 MB.')
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${userId}/comprobante-${uuid()}${ext ? `.${ext}` : ''}`
      const { error } = await createClient().storage.from('partner-docs').upload(path, file, { upsert: false })
      if (error) throw error
      setProof(path)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'No se pudo subir el archivo.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <form action={formAction} onSubmit={() => setSubmitted(true)} className="rounded-2xl border border-stone/15 bg-white p-5 space-y-4">
      {verified && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">✅ Tu cuenta ya está verificada. Si la cambias, la volveremos a revisar.</p>}
      <div>
        <label className={label}>Nombre del titular (como aparece en el banco) *</label>
        <input name="bank_holder" defaultValue={initial.bank_holder} required className={input} />
      </div>
      <div>
        <label className={label}>CLABE interbancaria (18 dígitos) *</label>
        <input
          name="bank_clabe"
          value={clabe}
          onChange={(e) => setClabe(e.target.value)}
          inputMode="numeric"
          maxLength={22}
          required
          className={input}
          placeholder="000000000000000000"
        />
        <p className="mt-1 text-xs">
          {digits.length === 0 ? (
            <span className="text-stone">La encuentras en tu app del banco o en tu estado de cuenta.</span>
          ) : digits.length < 18 ? (
            <span className="text-stone">Van {digits.length} de 18 dígitos{bank ? ` · ${bank}` : ''}.</span>
          ) : valid ? (
            <span className="text-emerald-700">✅ CLABE válida{bank ? ` · ${bank}` : ''}</span>
          ) : (
            <span className="text-burnt-orange">Esa CLABE no es válida. Revisa los números.</span>
          )}
        </p>
      </div>
      <div>
        <label className={label}>RFC (opcional)</label>
        <input name="bank_rfc" defaultValue={initial.bank_rfc} className={input} />
      </div>
      <div>
        <label className={label}>Carátula de tu estado de cuenta (PDF o foto) *</label>
        <input type="hidden" name="bank_proof_path" value={proof} />
        <input type="file" accept="application/pdf,image/*" onChange={(e) => upload(e.target.files?.[0])} className="text-xs" />
        <p className="mt-1 text-xs text-stone">
          {uploading ? 'Subiendo…' : proof ? '✅ Comprobante cargado.' : 'Donde se vean tu nombre, el banco y la CLABE. Solo lo ve Huasca Retreats.'}
        </p>
        {uploadError && <p className="text-xs text-burnt-orange">{uploadError}</p>}
      </div>
      {state.error && <p className="rounded-lg bg-burnt-orange/10 px-3 py-2 text-sm text-burnt-orange">{state.error}</p>}
      {submitted && !pending && !state.error && <p className="text-sm text-navy-deep">Datos guardados ✅ Te avisamos cuando estén verificados.</p>}
      <button
        disabled={pending || uploading || valid === false}
        className="rounded-full bg-navy-deep px-6 py-2.5 text-sm font-medium text-cream disabled:opacity-50"
      >
        {pending ? 'Guardando…' : 'Guardar datos de pago'}
      </button>
    </form>
  )
}
