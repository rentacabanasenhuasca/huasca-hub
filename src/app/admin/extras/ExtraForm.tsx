'use client'

import { useActionState, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { uuid } from '@/lib/uuid'

export type AddonRecord = {
  id: string
  name: string
  description: string | null
  price_mxn: number
  unit: 'flat' | 'per_unit'
  max_quantity: number
  photo_url: string | null
  active: boolean
  sort_order: number
  property_ids: string[]
}

export type PropertyOption = { id: string; name: string }

const inputClass =
  'w-full rounded-lg border border-stone/30 bg-white px-3 py-2 text-sm text-navy-deep placeholder:text-stone/50 focus:outline-none focus:ring-2 focus:ring-gold'
const labelClass = 'block text-xs font-medium text-stone mb-1'

type Action = (prev: { error: string | null }, formData: FormData) => Promise<{ error: string | null }>

export default function ExtraForm({
  action,
  addon,
  submitLabel,
  onDone,
  properties,
}: {
  action: Action
  addon?: AddonRecord
  submitLabel: string
  onDone?: () => void
  properties: PropertyOption[]
}) {
  const [state, formAction, pending] = useActionState(action, { error: null })
  const [unit, setUnit] = useState<'flat' | 'per_unit'>(addon?.unit ?? 'flat')
  const [photoUrl, setPhotoUrl] = useState(addon?.photo_url ?? '')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [selectedProps, setSelectedProps] = useState<Set<string>>(new Set(addon?.property_ids ?? []))

  function toggleProp(id: string) {
    setSelectedProps((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handlePhoto(file: File) {
    setUploading(true)
    setUploadError(null)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `${uuid()}${ext ? `.${ext}` : ''}`
      const { error } = await supabase.storage.from('property-photos').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      })
      if (error) throw error
      const { data } = supabase.storage.from('property-photos').getPublicUrl(path)
      setPhotoUrl(data.publicUrl)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'No se pudo subir la foto.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <form
      action={async (formData) => {
        await formAction(formData)
        onDone?.()
      }}
      className="space-y-4"
    >
      {state.error && (
        <div className="rounded-lg bg-burnt-orange/10 border border-burnt-orange/30 px-3 py-2 text-sm text-burnt-orange">
          {state.error}
        </div>
      )}

      <input type="hidden" name="photo_url" value={photoUrl} />

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="sm:col-span-2">
          <span className={labelClass}>Nombre</span>
          <input
            name="name"
            defaultValue={addon?.name}
            required
            className={inputClass}
            placeholder="Jacuzzi, Early Check In, Kit de smores…"
          />
        </label>

        <label className="sm:col-span-2">
          <span className={labelClass}>Descripción (opcional)</span>
          <textarea
            name="description"
            defaultValue={addon?.description ?? ''}
            rows={2}
            className={inputClass}
            placeholder="Qué incluye, horarios, condiciones…"
          />
        </label>

        <label>
          <span className={labelClass}>Precio (MXN)</span>
          <input
            type="number"
            name="price_mxn"
            defaultValue={addon?.price_mxn ?? ''}
            min={0}
            step="0.01"
            required
            className={inputClass}
          />
        </label>

        <label>
          <span className={labelClass}>Tipo</span>
          <select
            name="unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value as 'flat' | 'per_unit')}
            className={inputClass}
          >
            <option value="flat">Único (agregar / quitar)</option>
            <option value="per_unit">Por cantidad (ej. personas, horas)</option>
          </select>
        </label>

        {unit === 'per_unit' && (
          <label>
            <span className={labelClass}>Cantidad máxima</span>
            <input
              type="number"
              name="max_quantity"
              defaultValue={addon?.max_quantity ?? 4}
              min={1}
              className={inputClass}
            />
          </label>
        )}

        <label>
          <span className={labelClass}>Orden (menor número aparece primero)</span>
          <input
            type="number"
            name="sort_order"
            defaultValue={addon?.sort_order ?? 0}
            className={inputClass}
          />
        </label>
      </div>

      <div>
        <span className={labelClass}>Foto (opcional)</span>
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="h-24 w-24 rounded-lg object-cover mb-2" />
        )}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handlePhoto(file)
          }}
          className="text-sm text-stone file:mr-3 file:rounded-lg file:border-0 file:bg-navy file:px-4 file:py-2 file:text-sm file:font-medium file:text-cream file:cursor-pointer hover:file:bg-navy-deep file:transition"
        />
        {uploading && <p className="text-xs text-stone mt-1">Subiendo…</p>}
        {uploadError && <p className="text-xs text-burnt-orange mt-1">{uploadError}</p>}
      </div>

      <label className="flex items-center gap-2 text-sm text-navy-deep">
        <input type="checkbox" name="active" defaultChecked={addon?.active ?? true} className="rounded border-stone/40" />
        Activo (visible en el checkout)
      </label>

      {properties.length > 0 && (
        <div className="rounded-lg border border-stone/20 bg-cream/40 p-3 space-y-2">
          <span className={labelClass + ' mb-0'}>
            Unidades donde aplica (vacío = todas tus cabañas)
          </span>
          <div className="flex flex-wrap gap-3">
            {properties.map((p) => (
              <label key={p.id} className="flex items-center gap-1.5 text-xs text-navy-deep">
                <input
                  type="checkbox"
                  name="property_ids"
                  value={p.id}
                  checked={selectedProps.has(p.id)}
                  onChange={() => toggleProp(p.id)}
                  className="rounded border-stone/40"
                />
                {p.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={pending || uploading}
        className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-cream hover:bg-navy-deep transition disabled:opacity-60"
      >
        {pending ? 'Guardando…' : submitLabel}
      </button>
    </form>
  )
}
