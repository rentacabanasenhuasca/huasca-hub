'use client'

// Formulario de una casa en venta: datos, precio, características, fotos y
// videos. Las fotos van al bucket property-photos y los videos a site-media
// (que acepta archivos de hasta 200 MB); aquí solo se guardan sus links.
import { useActionState, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { uuid } from '@/lib/uuid'
import { optimizedImage } from '@/lib/media'
import { SALE_STATUS_LABEL, type SaleListing, type SaleMedia } from '@/lib/sale-listings'

type Action = (prev: { error: string | null }, formData: FormData) => Promise<{ error: string | null }>
type MediaRow = SaleMedia & { _key: string }

const inputClass =
  'w-full rounded-lg border border-stone/30 bg-white px-3 py-2 text-sm text-navy-deep placeholder:text-stone/50 focus:outline-none focus:ring-2 focus:ring-gold'
const labelClass = 'block text-xs font-medium text-stone mb-1'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-stone/15 bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-deep mb-4">{title}</h2>
      {children}
    </section>
  )
}

export default function SaleListingForm({
  action,
  listing,
  media = [],
  properties,
  submitLabel,
}: {
  action: Action
  listing?: SaleListing
  media?: SaleMedia[]
  properties: { id: string; name: string }[]
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState(action, { error: null })
  const [rows, setRows] = useState<MediaRow[]>(media.map((m) => ({ ...m, _key: uuid() })))
  const [uploading, setUploading] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function uploadFiles(files: FileList) {
    setUploadError(null)
    const supabase = createClient()
    const list = Array.from(files)
    setUploading((n) => n + list.length)
    for (const file of list) {
      const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(file.name)
      const bucket = isVideo ? 'site-media' : 'property-photos'
      const ext = file.name.split('.').pop()
      const path = `ventas/${uuid()}${ext ? `.${ext.toLowerCase()}` : ''}`
      try {
        if (isVideo && file.size > 200 * 1024 * 1024) throw new Error(`${file.name}: el video pesa más de 200 MB.`)
        const { error } = await supabase.storage.from(bucket).upload(path, file, { cacheControl: '3600', upsert: false })
        if (error) throw error
        const { data } = supabase.storage.from(bucket).getPublicUrl(path)
        setRows((prev) => [...prev, { kind: isVideo ? 'video' : 'image', url: data.publicUrl, caption: '', _key: uuid() }])
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : `No se pudo subir ${file.name}.`)
      } finally {
        setUploading((n) => n - 1)
      }
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  function move(key: string, dir: -1 | 1) {
    setRows((prev) => {
      const i = prev.findIndex((r) => r._key === key)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  const mediaJson = JSON.stringify(rows.map(({ kind, url, caption }) => ({ kind, url, caption })))

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="media_json" value={mediaJson} readOnly />

      <Section title="Datos principales">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={labelClass}>Título de la casa *</span>
            <input name="title" required defaultValue={listing?.title ?? ''} className={inputClass} placeholder="Ej. Casa de campo con bosque propio en Huasca" />
          </label>
          <label>
            <span className={labelClass}>Estado</span>
            <select name="status" defaultValue={listing?.status ?? 'draft'} className={inputClass}>
              {Object.entries(SALE_STATUS_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClass}>Ubicación (zona, municipio)</span>
            <input name="location" defaultValue={listing?.location ?? ''} className={inputClass} placeholder="Ej. San Miguel Regla, Huasca de Ocampo" />
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>Resumen corto (aparece en la tarjeta del listado)</span>
            <input name="summary" maxLength={180} defaultValue={listing?.summary ?? ''} className={inputClass} placeholder="Ej. 3 recámaras, chimenea y 2,000 m² de terreno arbolado" />
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>Descripción completa</span>
            <textarea name="description" rows={8} defaultValue={listing?.description ?? ''} className={inputClass} placeholder="Cuenta todo: la casa, el terreno, la zona, servicios, escrituras, etc." />
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>¿Es una de tus cabañas en renta? (opcional)</span>
            <select name="property_id" defaultValue={listing?.property_id ?? ''} className={inputClass}>
              <option value="">No, es una casa aparte</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-stone">
              Si la eliges, la página de esa cabaña mostrará un aviso con link a esta página de venta.
            </span>
          </label>
        </div>
      </Section>

      <Section title="Precio">
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className={labelClass}>Precio de venta (MXN)</span>
            <input name="price_mxn" inputMode="numeric" defaultValue={listing?.price_mxn ?? ''} className={inputClass} placeholder="Ej. 3500000 (vacío = no mostrar precio)" />
          </label>
          <label>
            <span className={labelClass}>Nota del precio</span>
            <input name="price_note" defaultValue={listing?.price_note ?? ''} className={inputClass} placeholder="Ej. Precio a tratar · Acepta crédito" />
          </label>
        </div>
      </Section>

      <Section title="Características">
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
          <label>
            <span className={labelClass}>Recámaras</span>
            <input name="bedrooms" type="number" min={0} defaultValue={listing?.bedrooms ?? ''} className={inputClass} />
          </label>
          <label>
            <span className={labelClass}>Baños</span>
            <input name="bathrooms" type="number" min={0} step={0.5} defaultValue={listing?.bathrooms ?? ''} className={inputClass} />
          </label>
          <label>
            <span className={labelClass}>Terreno (m²)</span>
            <input name="land_m2" type="number" min={0} defaultValue={listing?.land_m2 ?? ''} className={inputClass} />
          </label>
          <label>
            <span className={labelClass}>Construcción (m²)</span>
            <input name="built_m2" type="number" min={0} defaultValue={listing?.built_m2 ?? ''} className={inputClass} />
          </label>
          <label>
            <span className={labelClass}>Estacionamiento</span>
            <input name="parking" type="number" min={0} defaultValue={listing?.parking ?? ''} className={inputClass} />
          </label>
        </div>
        <label className="mt-4 block">
          <span className={labelClass}>Otras características (una por línea)</span>
          <textarea
            name="features"
            rows={5}
            defaultValue={(listing?.features ?? []).join('\n')}
            className={inputClass}
            placeholder={'Chimenea\nEscrituras en regla\nPozo de agua propio\nA 5 min del pueblo'}
          />
        </label>
      </Section>

      <Section title="Fotos y videos">
        <p className="text-xs text-stone mb-3">
          Sube fotos (JPG/PNG) y videos (MP4/MOV, hasta 200 MB). La primera foto es la portada. Usa las flechas para ordenarlas.
        </p>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-cream hover:bg-navy-deep transition"
          >
            + Subir fotos o videos
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/mp4,video/quicktime,video/webm"
            multiple
            hidden
            onChange={(e) => e.target.files && uploadFiles(e.target.files)}
          />
          {uploading > 0 && <span className="text-sm text-stone">Subiendo {uploading} archivo(s)… no cierres la página.</span>}
          {uploadError && <span className="text-sm text-burnt-orange">{uploadError}</span>}
        </div>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone/30 p-6 text-center text-sm text-stone">Aún no hay fotos ni videos.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r, i) => (
              <div key={r._key} className="rounded-lg border border-stone/15 p-2">
                <div className="relative">
                  {r.kind === 'video' ? (
                    <video src={r.url} className="h-36 w-full rounded object-cover bg-black" muted playsInline preload="metadata" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={optimizedImage(r.url, 384)} alt="" className="h-36 w-full rounded object-cover" />
                  )}
                  <span className="absolute left-1.5 top-1.5 rounded bg-navy-deep/80 px-1.5 py-0.5 text-[10px] text-cream">
                    {i === 0 && r.kind === 'image' ? 'Portada' : r.kind === 'video' ? 'Video' : `Foto ${i + 1}`}
                  </span>
                </div>
                <input
                  value={r.caption ?? ''}
                  onChange={(e) => setRows((prev) => prev.map((x) => (x._key === r._key ? { ...x, caption: e.target.value } : x)))}
                  placeholder="Descripción (opcional)"
                  className={`${inputClass} mt-2 text-xs`}
                />
                <div className="mt-2 flex items-center justify-between text-xs">
                  <div className="flex gap-1">
                    <button type="button" onClick={() => move(r._key, -1)} disabled={i === 0} className="rounded border border-stone/25 px-2 py-0.5 disabled:opacity-30">
                      ←
                    </button>
                    <button type="button" onClick={() => move(r._key, 1)} disabled={i === rows.length - 1} className="rounded border border-stone/25 px-2 py-0.5 disabled:opacity-30">
                      →
                    </button>
                  </div>
                  <button type="button" onClick={() => setRows((prev) => prev.filter((x) => x._key !== r._key))} className="text-burnt-orange">
                    Quitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <label className="mt-4 block">
          <span className={labelClass}>Video de YouTube o Vimeo (opcional)</span>
          <input name="video_url" defaultValue={listing?.video_url ?? ''} className={inputClass} placeholder="https://www.youtube.com/watch?v=…" />
        </label>
      </Section>

      <Section title="Ubicación y contacto">
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className={labelClass}>Link de Google Maps (opcional)</span>
            <input name="google_maps_link" defaultValue={listing?.google_maps_link ?? ''} className={inputClass} placeholder="https://maps.app.goo.gl/…" />
          </label>
          <label>
            <span className={labelClass}>WhatsApp para informes (vacío = el tuyo)</span>
            <input name="contact_whatsapp" defaultValue={listing?.contact_whatsapp ?? ''} className={inputClass} placeholder="Ej. 7711234567" />
          </label>
        </div>
        {listing && (
          <label className="mt-4 flex items-center gap-2 text-sm text-navy-deep">
            <input type="checkbox" name="regenerate_slug" className="rounded border-stone/40" />
            Cambiar el link para que coincida con el título nuevo (los links que ya compartiste dejarían de funcionar)
          </label>
        )}
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={pending || uploading > 0}
          className="rounded-lg bg-navy-deep px-6 py-2.5 text-sm font-semibold text-cream hover:bg-navy transition disabled:opacity-50"
        >
          {pending ? 'Guardando…' : uploading > 0 ? 'Espera a que terminen de subir…' : submitLabel}
        </button>
        {state.error && <p className="text-sm text-burnt-orange">{state.error}</p>}
      </div>
    </form>
  )
}
