'use client'

import { useActionState, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { uuid } from '@/lib/uuid'

export type Amenity = { id: string; category: string; label: string; sort_order: number }
export type PropertyRecord = {
  id?: string
  name: string
  description: string | null
  capacity: number
  bedrooms: number
  beds: number
  bathrooms: number
  infants_count_toward_capacity: boolean
  max_infants: number | null
  max_children: number | null
  weekday_price_mxn: number
  weekend_price_mxn: number
  price_tier: 'accesible' | 'media' | 'lujo' | null
  base_occupancy: number
  extra_guest_fee_mxn: number
  google_maps_link: string | null
  lat: number | null
  lng: number | null
  show_exact_location: boolean
  pet_friendly: boolean
  status: 'draft' | 'published'
  min_nights: number
  min_nights_by_day: Record<string, number> | null
  max_nights: number | null
  min_advance_days: number
  booking_window_days: number
  allowed_arrival_days: number[]
  allowed_departure_days: number[]
  cancellation_policy: 'flexible' | 'moderada' | 'estricta'
}
export type PhotoRecord = { url: string; category: string | null; description: string | null }
// _key: identificador solo local (nunca se manda al server) para poder
// arrastrar/soltar y subir varias fotos a la vez sin depender del índice del
// arreglo, que cambia mientras las fotos siguen subiendo.
type PhotoRow = PhotoRecord & { _key: string }

export type BedRecord = { room_type: 'recamara' | 'altillo_tapanco'; bed_type: string; quantity: number }
type BedRow = BedRecord & { _key: string }

const ROOM_TYPE_LABELS: Record<string, string> = {
  recamara: 'Recámara',
  altillo_tapanco: 'Altillo / Tapanco',
}

const BED_TYPE_LABELS: Record<string, string> = {
  individual: 'Individual',
  matrimonial: 'Matrimonial',
  queen: 'Queen',
  king: 'King',
  litera: 'Litera',
  cuna: 'Cuna',
}

const CATEGORY_LABELS: Record<string, string> = {
  destacado: 'Destacado',
  bano: 'Baño',
  recamara_lavanderia: 'Recámara y lavandería',
  entretenimiento: 'Entretenimiento',
  familia: 'Familia',
  clima: 'Clima',
  seguridad: 'Seguridad del hogar',
  internet_oficina: 'Internet y oficina',
  cocina_comedor: 'Cocina y comedor',
  exterior: 'Exterior',
  estacionamiento: 'Estacionamiento e instalaciones',
  servicios: 'Servicios',
}

const DAYS = [
  { key: '0', label: 'Dom' },
  { key: '1', label: 'Lun' },
  { key: '2', label: 'Mar' },
  { key: '3', label: 'Mié' },
  { key: '4', label: 'Jue' },
  { key: '5', label: 'Vie' },
  { key: '6', label: 'Sáb' },
]

const inputClass =
  'w-full rounded-lg border border-stone/30 bg-white px-3 py-2 text-sm text-navy-deep placeholder:text-stone/50 focus:outline-none focus:ring-2 focus:ring-gold'
const labelClass = 'block text-xs font-medium text-stone mb-1'

type Action = (prev: { error: string | null }, formData: FormData) => Promise<{ error: string | null }>

export default function PropertyForm({
  action,
  amenities,
  property,
  selectedAmenities = {},
  photos = [],
  beds = [],
  submitLabel,
}: {
  action: Action
  amenities: Amenity[]
  property?: PropertyRecord
  selectedAmenities?: Record<string, string | null>
  photos?: PhotoRecord[]
  beds?: BedRecord[]
  submitLabel: string
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(action, { error: null })
  const [checkedAmenities, setCheckedAmenities] = useState<Set<string>>(
    new Set(Object.keys(selectedAmenities))
  )
  const [photoRows, setPhotoRows] = useState<PhotoRow[]>(
    photos.length > 0
      ? photos.map((p) => ({ ...p, _key: uuid() }))
      : [{ url: '', category: '', description: '', _key: uuid() }]
  )
  const [uploadingKeys, setUploadingKeys] = useState<Set<string>>(new Set())
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({})
  const dragKeyRef = useRef<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)
  const [bedRows, setBedRows] = useState<BedRow[]>(
    beds.length > 0
      ? beds.map((b) => ({ ...b, _key: uuid() }))
      : [{ room_type: 'recamara', bed_type: 'matrimonial', quantity: 1, _key: uuid() }]
  )

  async function uploadFile(key: string, file: File) {
    setUploadingKeys((prev) => new Set(prev).add(key))
    setUploadErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })

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

      setPhotoRows((rows) => rows.map((row) => (row._key === key ? { ...row, url: data.publicUrl } : row)))
    } catch (e) {
      setUploadErrors((prev) => ({
        ...prev,
        [key]: e instanceof Error ? e.message : 'No se pudo subir la foto.',
      }))
    } finally {
      setUploadingKeys((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  // Reemplaza la foto de una fila que ya existe (input individual de cada
  // tarjeta).
  function handleFileSelected(key: string, file: File) {
    uploadFile(key, file)
  }

  // Botón de arriba: agrega y sube varias fotos de un jalón. Si la única
  // fila que hay todavía está vacía (formulario recién abierto), la primera
  // foto la ocupa en vez de agregar una fila extra.
  function handleMultipleFilesSelected(fileList: FileList) {
    const files = Array.from(fileList)
    if (files.length === 0) return

    setPhotoRows((rows) => {
      const next = [...rows]
      let firstEmptyIdx = next.findIndex((r) => !r.url)
      const newKeys: string[] = []

      for (let n = 0; n < files.length; n++) {
        if (firstEmptyIdx !== -1) {
          newKeys.push(next[firstEmptyIdx]._key)
          firstEmptyIdx = -1
        } else {
          const key = uuid()
          next.push({ url: '', category: '', description: '', _key: key })
          newKeys.push(key)
        }
      }

      files.forEach((file, i) => uploadFile(newKeys[i], file))
      return next
    })
  }

  function handleDrop(targetKey: string) {
    const draggedKey = dragKeyRef.current
    dragKeyRef.current = null
    setDragOverKey(null)
    if (!draggedKey || draggedKey === targetKey) return

    setPhotoRows((rows) => {
      const from = rows.findIndex((r) => r._key === draggedKey)
      const to = rows.findIndex((r) => r._key === targetKey)
      if (from === -1 || to === -1) return rows
      const next = [...rows]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  const grouped = amenities.reduce<Record<string, Amenity[]>>((acc, a) => {
    ;(acc[a.category] ||= []).push(a)
    return acc
  }, {})

  function toggleAmenity(id: string) {
    setCheckedAmenities((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <form action={formAction} className="space-y-8 pb-16">
      {state.error && (
        <div className="rounded-lg bg-burnt-orange/10 border border-burnt-orange/30 px-4 py-3 text-sm text-burnt-orange">
          {state.error}
        </div>
      )}

      <Section title="Datos básicos">
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="sm:col-span-2">
            <span className={labelClass}>Nombre de la propiedad</span>
            <input name="name" defaultValue={property?.name} required className={inputClass} placeholder="Cozy Cabin" />
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>Descripción</span>
            <textarea
              name="description"
              defaultValue={property?.description ?? ''}
              rows={4}
              className={inputClass}
              placeholder="Describe la propiedad, el ambiente, qué la hace especial…"
            />
          </label>
          <NumberField label="Capacidad (huéspedes)" name="capacity" defaultValue={property?.capacity ?? 2} min={1} />
          <NumberField label="Recámaras" name="bedrooms" defaultValue={property?.bedrooms ?? 1} min={0} />
          <NumberField label="Camas" name="beds" defaultValue={property?.beds ?? 1} min={0} />
          <NumberField
            label="Baños"
            name="bathrooms"
            defaultValue={property?.bathrooms ?? 1}
            min={0}
            step={0.5}
          />
        </div>
      </Section>

      <Section title="Camas">
        <p className="text-xs text-stone mb-3">
          Especifica el tamaño de cada cama y si está en una recámara normal o en un altillo/tapanco,
          para que el huésped sepa exactamente qué está rentando. El número de &quot;Camas&quot; de
          arriba es solo el total; esta lista es la que se muestra en la página de la propiedad.
        </p>
        <div className="space-y-3">
          {bedRows.map((row) => (
            <div key={row._key} className="grid sm:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end">
              <input type="hidden" name="bed_room_type" value={row.room_type} readOnly />
              <input type="hidden" name="bed_type" value={row.bed_type} readOnly />
              <input type="hidden" name="bed_quantity" value={row.quantity} readOnly />
              <label>
                <span className={labelClass}>Espacio</span>
                <select
                  value={row.room_type}
                  onChange={(e) =>
                    setBedRows((rows) =>
                      rows.map((r) =>
                        r._key === row._key
                          ? { ...r, room_type: e.target.value as BedRecord['room_type'] }
                          : r
                      )
                    )
                  }
                  className={inputClass}
                >
                  {Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className={labelClass}>Tipo de cama</span>
                <select
                  value={row.bed_type}
                  onChange={(e) =>
                    setBedRows((rows) =>
                      rows.map((r) => (r._key === row._key ? { ...r, bed_type: e.target.value } : r))
                    )
                  }
                  className={inputClass}
                >
                  {Object.entries(BED_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className={labelClass}>Cantidad</span>
                <input
                  type="number"
                  min={1}
                  value={row.quantity}
                  onChange={(e) =>
                    setBedRows((rows) =>
                      rows.map((r) =>
                        r._key === row._key ? { ...r, quantity: Number(e.target.value) || 1 } : r
                      )
                    )
                  }
                  className={`${inputClass} w-20`}
                />
              </label>
              <button
                type="button"
                onClick={() => setBedRows((rows) => rows.filter((r) => r._key !== row._key))}
                className="text-xs text-burnt-orange px-2 py-2"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setBedRows((rows) => [
              ...rows,
              { room_type: 'recamara', bed_type: 'matrimonial', quantity: 1, _key: uuid() },
            ])
          }
          className="text-sm text-gold underline underline-offset-2 mt-3"
        >
          + Agregar cama
        </button>
      </Section>

      <Section title="Política de menores">
        <div className="grid sm:grid-cols-3 gap-4">
          <label className="flex items-center gap-2 text-sm text-navy-deep sm:col-span-3">
            <input
              type="checkbox"
              name="infants_count_toward_capacity"
              defaultChecked={property?.infants_count_toward_capacity}
              className="rounded border-stone/40"
            />
            Los bebés cuentan para el límite de capacidad
          </label>
          <NumberField
            label="Máximo de bebés (vacío = sin límite)"
            name="max_infants"
            defaultValue={property?.max_infants ?? ''}
            min={0}
          />
          <NumberField
            label="Máximo de niños (vacío = sin límite)"
            name="max_children"
            defaultValue={property?.max_children ?? ''}
            min={0}
          />
        </div>
      </Section>

      <Section title="Precios">
        <div className="grid sm:grid-cols-3 gap-4">
          <NumberField
            label="Precio entre semana (MXN)"
            name="weekday_price_mxn"
            defaultValue={property?.weekday_price_mxn ?? ''}
            min={0}
            required
          />
          <NumberField
            label="Precio fin de semana (MXN)"
            name="weekend_price_mxn"
            defaultValue={property?.weekend_price_mxn ?? ''}
            min={0}
            required
          />
          <label>
            <span className={labelClass}>Rango de precio</span>
            <select name="price_tier" defaultValue={property?.price_tier ?? ''} className={inputClass}>
              <option value="">Sin definir</option>
              <option value="accesible">Accesible</option>
              <option value="media">Media</option>
              <option value="lujo">Lujo</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-stone mt-2 mb-4">
          Este es el precio base. Las reglas de temporada (calendario) lo sobreescriben por fecha.
        </p>

        <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-stone/15">
          <NumberField
            label="El precio base incluye hasta cuántas personas"
            name="base_occupancy"
            defaultValue={property?.base_occupancy ?? property?.capacity ?? 2}
            min={1}
          />
          <NumberField
            label="Costo por persona extra por noche (MXN)"
            name="extra_guest_fee_mxn"
            defaultValue={property?.extra_guest_fee_mxn ?? 0}
            min={0}
          />
        </div>
        <p className="text-xs text-stone mt-2">
          Ej. si el precio base incluye 4 personas y agregas $500 por persona extra, una reserva de
          6 personas suma $1,000/noche al precio base. Una regla de temporada puede sobreescribir
          este costo extra solo para sus fechas.
        </p>
      </Section>

      <Section title="Ubicación">
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="sm:col-span-2">
            <span className={labelClass}>Link de Google Maps</span>
            <input
              name="google_maps_link"
              defaultValue={property?.google_maps_link ?? ''}
              className={inputClass}
              placeholder="https://maps.google.com/…"
            />
          </label>
          <NumberField label="Latitud" name="lat" defaultValue={property?.lat ?? ''} step={0.000001} />
          <NumberField label="Longitud" name="lng" defaultValue={property?.lng ?? ''} step={0.000001} />
          <label className="flex items-center gap-2 text-sm text-navy-deep sm:col-span-2">
            <input
              type="checkbox"
              name="show_exact_location"
              defaultChecked={property?.show_exact_location}
              className="rounded border-stone/40"
            />
            Mostrar ubicación exacta al huésped (si no, se muestra aproximada hasta reservar)
          </label>
        </div>
      </Section>

      <Section title="Publicación">
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="flex items-center gap-2 text-sm text-navy-deep">
            <input
              type="checkbox"
              name="pet_friendly"
              defaultChecked={property?.pet_friendly}
              className="rounded border-stone/40"
            />
            Pet friendly
          </label>
          <label>
            <span className={labelClass}>Estado</span>
            <select name="status" defaultValue={property?.status ?? 'draft'} className={inputClass}>
              <option value="draft">Borrador (no visible al público)</option>
              <option value="published">Publicada</option>
            </select>
          </label>
        </div>
      </Section>

      <Section title="Reglas de reserva por defecto">
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <NumberField label="Noches mínimas (general)" name="min_nights" defaultValue={property?.min_nights ?? 1} min={1} />
          <NumberField
            label="Noches máximas (vacío = sin límite)"
            name="max_nights"
            defaultValue={property?.max_nights ?? ''}
            min={1}
          />
          <NumberField
            label="Días de anticipación mínima"
            name="min_advance_days"
            defaultValue={property?.min_advance_days ?? 0}
            min={0}
          />
          <NumberField
            label="Ventana de reserva (días a futuro)"
            name="booking_window_days"
            defaultValue={property?.booking_window_days ?? 365}
            min={1}
          />
          <label>
            <span className={labelClass}>Política de cancelación</span>
            <select
              name="cancellation_policy"
              defaultValue={property?.cancellation_policy ?? 'moderada'}
              className={inputClass}
            >
              <option value="flexible">Flexible</option>
              <option value="moderada">Moderada</option>
              <option value="estricta">Estricta</option>
            </select>
          </label>
        </div>

        <DayPicker
          label="Días de llegada permitidos"
          field="arrival"
          defaultDays={property?.allowed_arrival_days ?? [0, 1, 2, 3, 4, 5, 6]}
        />
        <DayPicker
          label="Días de salida permitidos"
          field="departure"
          defaultDays={property?.allowed_departure_days ?? [0, 1, 2, 3, 4, 5, 6]}
        />

        <div className="pt-4 border-t border-stone/15">
          <span className={labelClass}>Noches mínimas por día de la semana (opcional)</span>
          <p className="text-xs text-stone mb-3">
            Solo para los días que quieras que pidan más noches que el general de arriba — por
            ejemplo, 2 noches mínimo si la llegada es viernes o sábado. Deja vacío el día que deba
            usar el general. Una regla de precio o un ajuste manual en el calendario para una fecha
            específica sigue ganando sobre esto.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {DAYS.map((d) => (
              <label key={d.key}>
                <span className={labelClass}>{d.label}</span>
                <input
                  type="number"
                  name={`min_nights_day_${d.key}`}
                  defaultValue={property?.min_nights_by_day?.[d.key] ?? ''}
                  min={1}
                  placeholder="General"
                  className={inputClass}
                />
              </label>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Amenidades">
        <div className="space-y-5">
          {Object.entries(grouped).map(([category, list]) => (
            <div key={category}>
              <h3 className="text-sm font-medium text-navy-deep mb-2">
                {CATEGORY_LABELS[category] ?? category}
              </h3>
              <div className="grid sm:grid-cols-2 gap-2">
                {list.map((a) => {
                  const checked = checkedAmenities.has(a.id)
                  return (
                    <div key={a.id} className="flex flex-col gap-1">
                      <label className="flex items-center gap-2 text-sm text-navy-deep">
                        <input
                          type="checkbox"
                          name="amenity_ids"
                          value={a.id}
                          checked={checked}
                          onChange={() => toggleAmenity(a.id)}
                          className="rounded border-stone/40"
                        />
                        {a.label}
                      </label>
                      {checked && (
                        <input
                          type="text"
                          name={`amenity_note_${a.id}`}
                          defaultValue={selectedAmenities[a.id] ?? ''}
                          placeholder="Nota opcional (ej. Jacuzzi para 4, vista al bosque)"
                          className="ml-6 rounded border border-stone/20 bg-white px-2 py-1 text-xs text-navy-deep placeholder:text-stone/40 focus:outline-none focus:ring-1 focus:ring-gold"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Fotos">
        <div className="space-y-4">
          <div className="rounded-lg border border-dashed border-gold/50 bg-gold/5 p-4">
            <span className={labelClass}>Subir varias fotos a la vez</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                if (e.target.files) handleMultipleFilesSelected(e.target.files)
                e.target.value = ''
              }}
              className="w-full text-xs text-navy-deep file:mr-2 file:rounded file:border-0 file:bg-navy file:px-2 file:py-1 file:text-xs file:text-cream"
            />
            <p className="text-xs text-stone mt-1">
              Selecciona todas las que quieras (Cmd/Ctrl+clic para elegir varias) — se agregan y suben
              solas al final. Luego arrastra cada foto por el ícono ⠿ para ordenarlas; la primera es la
              portada.
            </p>
          </div>

          {photoRows.map((row) => {
            const isUploading = uploadingKeys.has(row._key)
            const error = uploadErrors[row._key]
            const isDragOver = dragOverKey === row._key
            return (
              <div
                key={row._key}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (dragOverKey !== row._key) setDragOverKey(row._key)
                }}
                onDragLeave={() => setDragOverKey((k) => (k === row._key ? null : k))}
                onDrop={(e) => {
                  e.preventDefault()
                  handleDrop(row._key)
                }}
                className={`rounded-lg border p-3 transition ${
                  isDragOver ? 'border-gold bg-gold/10' : 'border-stone/20'
                }`}
              >
                <input type="hidden" name="photo_url" value={row.url} readOnly />
                <div className="grid sm:grid-cols-[auto_auto_1fr_1fr_auto] gap-3 items-start">
                  <div
                    draggable
                    onDragStart={(e) => {
                      dragKeyRef.current = row._key
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onDragEnd={() => {
                      dragKeyRef.current = null
                      setDragOverKey(null)
                    }}
                    title="Arrastra para reordenar"
                    className="flex items-center justify-center h-16 w-6 cursor-grab active:cursor-grabbing text-stone/50 hover:text-stone select-none text-lg"
                  >
                    ⠿
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    {row.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.url}
                        alt=""
                        className="h-16 w-16 rounded object-cover border border-stone/20"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded border border-dashed border-stone/30 flex items-center justify-center text-[10px] text-stone">
                        {isUploading ? 'Subiendo…' : 'Sin foto'}
                      </div>
                    )}
                  </div>
                  <div>
                    <span className={labelClass}>{isUploading ? 'Subiendo…' : 'Foto (desde tu computadora)'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleFileSelected(row._key, file)
                      }}
                      className="w-full text-xs text-navy-deep file:mr-2 file:rounded file:border-0 file:bg-navy file:px-2 file:py-1 file:text-xs file:text-cream"
                    />
                    {error && <p className="text-xs text-burnt-orange mt-1">{error}</p>}
                  </div>
                  <div className="grid gap-2">
                    <input
                      name="photo_category"
                      defaultValue={row.category ?? ''}
                      placeholder="Categoría: Sala, Cocina…"
                      className={inputClass}
                    />
                    <input
                      name="photo_description"
                      defaultValue={row.description ?? ''}
                      placeholder="Descripción"
                      className={inputClass}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setPhotoRows((rows) => rows.filter((r) => r._key !== row._key))}
                    className="text-xs text-burnt-orange px-2 py-2"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            )
          })}
          <button
            type="button"
            onClick={() =>
              setPhotoRows((rows) => [...rows, { url: '', category: '', description: '', _key: uuid() }])
            }
            className="text-sm text-gold underline underline-offset-2"
          >
            + Agregar foto
          </button>
          <p className="text-xs text-stone">La primera foto es la portada.</p>
        </div>
      </Section>

      <div className="sticky bottom-0 bg-cream/95 backdrop-blur border-t border-stone/15 py-4 flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-navy px-6 py-2.5 text-sm font-medium text-cream hover:bg-navy-deep transition disabled:opacity-60"
        >
          {pending ? 'Guardando…' : submitLabel}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/propiedades')}
          className="rounded-lg px-6 py-2.5 text-sm font-medium text-stone hover:text-navy-deep transition"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-stone/15 bg-white p-5">
      <h2 className="text-sm font-semibold text-navy-deep mb-4 uppercase tracking-wide">{title}</h2>
      {children}
    </section>
  )
}

function NumberField({
  label,
  name,
  defaultValue,
  min,
  step,
  required,
}: {
  label: string
  name: string
  defaultValue: number | string
  min?: number
  step?: number
  required?: boolean
}) {
  return (
    <label>
      <span className={labelClass}>{label}</span>
      <input
        type="number"
        name={name}
        defaultValue={defaultValue}
        min={min}
        step={step}
        required={required}
        className={inputClass}
      />
    </label>
  )
}

function DayPicker({
  label,
  field,
  defaultDays,
}: {
  label: string
  field: string
  defaultDays: number[]
}) {
  return (
    <div className="mb-3">
      <span className={labelClass}>{label}</span>
      <div className="flex gap-3 flex-wrap">
        {DAYS.map((d) => (
          <label key={d.key} className="flex items-center gap-1.5 text-xs text-navy-deep">
            <input
              type="checkbox"
              name={`${field}_${d.key}`}
              defaultChecked={defaultDays.includes(Number(d.key))}
              className="rounded border-stone/40"
            />
            {d.label}
          </label>
        ))}
      </div>
    </div>
  )
}
