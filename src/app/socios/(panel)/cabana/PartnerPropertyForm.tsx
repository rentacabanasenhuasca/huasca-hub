'use client'

// Formulario del socio para registrar o editar su cabaña: fotos,
// descripción, servicios, ubicación, precio y mínimo de noches. Las fotos se
// suben directo a Storage en la carpeta del socio (partners/<su id>/).
import { useActionState, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { uuid } from '@/lib/uuid'

type Result = { error: string | null }
export type Amenity = { id: string; category: string; label: string }
export type PartnerPropertyValues = {
  name: string
  description: string
  location_text: string
  services_text: string
  google_maps_link: string
  capacity: number
  bedrooms: number
  beds: number
  bathrooms: number
  pet_friendly: boolean
  min_nights: number
  partner_price_weekday: number | ''
  partner_price_weekend: number | ''
  amenity_ids: string[]
  photos: string[]
}

const input =
  'w-full rounded-lg border border-stone/30 bg-white px-3 py-2 text-sm text-navy-deep placeholder:text-stone/50 focus:outline-none focus:ring-2 focus:ring-gold'
const label = 'block text-xs font-medium text-stone mb-1'

function money(n: number) {
  return `$${Math.round(n).toLocaleString('es-MX')}`
}

export default function PartnerPropertyForm({
  action,
  userId,
  amenities,
  initial,
  markupPct,
  feePct,
  submitLabel,
}: {
  action: (prev: Result, formData: FormData) => Promise<Result>
  userId: string
  amenities: Amenity[]
  initial: PartnerPropertyValues
  markupPct: number
  feePct: number
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState(action, { error: null })
  const [saved, setSaved] = useState(false)
  const wasPending = useRef(false)
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) setSaved(true)
    wasPending.current = pending
  }, [pending, state.error])
  const [photos, setPhotos] = useState<string[]>(initial.photos)
  const [uploading, setUploading] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [weekday, setWeekday] = useState<number | ''>(initial.partner_price_weekday)
  const [weekend, setWeekend] = useState<number | ''>(initial.partner_price_weekend)

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploadError(null)
    const supabase = createClient()
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        setUploadError('Solo se pueden subir imágenes.')
        continue
      }
      if (file.size > 12 * 1024 * 1024) {
        setUploadError(`"${file.name}" pesa más de 12 MB.`)
        continue
      }
      setUploading((n) => n + 1)
      try {
        const ext = file.name.split('.').pop()
        const path = `partners/${userId}/${uuid()}${ext ? `.${ext}` : ''}`
        const { error } = await supabase.storage.from('property-photos').upload(path, file, { cacheControl: '3600', upsert: false })
        if (error) throw error
        const { data } = supabase.storage.from('property-photos').getPublicUrl(path)
        setPhotos((prev) => [...prev, data.publicUrl])
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : 'No se pudo subir la foto.')
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }

  function move(i: number, delta: number) {
    setPhotos((prev) => {
      const next = [...prev]
      const j = i + delta
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  const byCategory = amenities.reduce<Record<string, Amenity[]>>((acc, a) => {
    ;(acc[a.category] ??= []).push(a)
    return acc
  }, {})

  const guest = (p: number | '') => (p ? Math.round((p * (1 + markupPct / 100)) / 10) * 10 : 0)
  const net = (p: number | '') => (p ? Math.round(p * (1 - feePct / 100)) : 0)

  return (
    <form action={formAction} onSubmit={() => setSaved(false)} className="space-y-6">
      <section className="rounded-2xl border border-stone/15 bg-white p-5 space-y-4">
        <h2 className="font-medium text-navy-deep">Tu espacio</h2>
        <div>
          <label className={label}>Nombre de la cabaña *</label>
          <input name="name" defaultValue={initial.name} required className={input} placeholder="Cabaña El Encino" />
        </div>
        <div>
          <label className={label}>Descripción *</label>
          <textarea
            name="description"
            defaultValue={initial.description}
            required
            rows={6}
            className={input}
            placeholder="Cuéntale al huésped cómo es tu espacio, qué lo hace especial y qué incluye."
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className={label}>Huéspedes máx.</label>
            <input type="number" name="capacity" min={1} defaultValue={initial.capacity} className={input} />
          </div>
          <div>
            <label className={label}>Recámaras</label>
            <input type="number" name="bedrooms" min={0} defaultValue={initial.bedrooms} className={input} />
          </div>
          <div>
            <label className={label}>Camas</label>
            <input type="number" name="beds" min={0} defaultValue={initial.beds} className={input} />
          </div>
          <div>
            <label className={label}>Baños</label>
            <input type="number" name="bathrooms" min={0} step={0.5} defaultValue={initial.bathrooms} className={input} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-navy-deep">
          <input type="checkbox" name="pet_friendly" defaultChecked={initial.pet_friendly} /> Acepto mascotas
        </label>
      </section>

      <section className="rounded-2xl border border-stone/15 bg-white p-5 space-y-4">
        <h2 className="font-medium text-navy-deep">Servicios</h2>
        {Object.entries(byCategory).map(([cat, list]) => (
          <div key={cat}>
            <p className="text-xs font-medium text-stone mb-1.5 capitalize">{cat}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {list.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm text-navy-deep">
                  <input type="checkbox" name="amenity_ids" value={a.id} defaultChecked={initial.amenity_ids.includes(a.id)} />
                  {a.label}
                </label>
              ))}
            </div>
          </div>
        ))}
        <div>
          <label className={label}>Otros servicios (opcional)</label>
          <input
            name="services_text"
            defaultValue={initial.services_text}
            className={input}
            placeholder="Ej. desayuno bajo pedido, fogata, estacionamiento para 2 autos"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-stone/15 bg-white p-5 space-y-4">
        <h2 className="font-medium text-navy-deep">Ubicación</h2>
        <div>
          <label className={label}>¿Dónde está? *</label>
          <input
            name="location_text"
            defaultValue={initial.location_text}
            required
            className={input}
            placeholder="Ej. A 5 min del centro de Huasca, camino a Peña del Aire"
          />
        </div>
        <div>
          <label className={label}>Liga de Google Maps (opcional)</label>
          <input name="google_maps_link" defaultValue={initial.google_maps_link} className={input} placeholder="https://maps.app.goo.gl/…" />
        </div>
      </section>

      <section className="rounded-2xl border border-stone/15 bg-white p-5 space-y-4">
        <h2 className="font-medium text-navy-deep">Precio y noches</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className={label}>Tu precio por noche, domingo a jueves *</label>
            <input
              type="number"
              name="partner_price_weekday"
              min={300}
              step={50}
              value={weekday}
              onChange={(e) => setWeekday(e.target.value === '' ? '' : Number(e.target.value))}
              required
              className={input}
            />
          </div>
          <div>
            <label className={label}>Tu precio por noche, viernes y sábado *</label>
            <input
              type="number"
              name="partner_price_weekend"
              min={300}
              step={50}
              value={weekend}
              onChange={(e) => setWeekend(e.target.value === '' ? '' : Number(e.target.value))}
              required
              className={input}
            />
          </div>
          <div>
            <label className={label}>Mínimo de noches</label>
            <input type="number" name="min_nights" min={1} max={30} defaultValue={initial.min_nights} className={input} />
          </div>
        </div>
        {(weekday || weekend) && (
          <div className="rounded-xl bg-cream/70 p-3 text-xs text-stone space-y-1">
            {weekday ? (
              <p>
                Entre semana: el huésped paga <strong className="text-navy-deep">{money(guest(weekday))}</strong> y tú recibes{' '}
                <strong className="text-navy-deep">{money(net(weekday))}</strong> por noche.
              </p>
            ) : null}
            {weekend ? (
              <p>
                Fin de semana: el huésped paga <strong className="text-navy-deep">{money(guest(weekend))}</strong> y tú recibes{' '}
                <strong className="text-navy-deep">{money(net(weekend))}</strong> por noche.
              </p>
            ) : null}
            <p>
              Al huésped se le suma el {markupPct}% de la plataforma y a ti se te descuenta el {feePct}% de comisión.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-stone/15 bg-white p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-medium text-navy-deep">Fotos *</h2>
          <label className="cursor-pointer rounded-lg border border-navy-deep/30 px-3 py-1.5 text-xs font-medium text-navy-deep hover:bg-navy-deep/5">
            {uploading > 0 ? `Subiendo ${uploading}…` : '+ Agregar fotos'}
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
          </label>
        </div>
        <p className="text-xs text-stone">Mínimo 3. La primera es la portada. Usa fotos horizontales, con buena luz.</p>
        {uploadError && <p className="text-xs text-burnt-orange">{uploadError}</p>}
        {photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {photos.map((url, i) => (
              <div key={url} className="relative rounded-xl overflow-hidden border border-stone/15">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-28 w-full object-cover" />
                <input type="hidden" name="photo_url" value={url} />
                {i === 0 && <span className="absolute left-1 top-1 rounded bg-navy-deep/80 px-1.5 text-[10px] text-cream">Portada</span>}
                <div className="flex justify-between bg-white/95 px-1.5 py-1 text-xs">
                  <div className="flex gap-1">
                    <button type="button" onClick={() => move(i, -1)} className="px-1 text-stone hover:text-navy-deep" aria-label="Mover antes">
                      ←
                    </button>
                    <button type="button" onClick={() => move(i, 1)} className="px-1 text-stone hover:text-navy-deep" aria-label="Mover después">
                      →
                    </button>
                  </div>
                  <button type="button" onClick={() => setPhotos((p) => p.filter((u) => u !== url))} className="text-burnt-orange">
                    Quitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {state.error && <p className="rounded-lg bg-burnt-orange/10 px-3 py-2 text-sm text-burnt-orange">{state.error}</p>}
      {!state.error && saved && <p className="text-sm text-navy-deep">Cambios guardados ✅</p>}
      <button
        type="submit"
        disabled={pending || uploading > 0}
        className="w-full sm:w-auto rounded-full bg-navy-deep px-6 py-2.5 text-sm font-medium text-cream hover:bg-navy-deep/90 disabled:opacity-50"
      >
        {pending ? 'Guardando…' : submitLabel}
      </button>
    </form>
  )
}
