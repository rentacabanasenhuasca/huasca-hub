'use client'

// Lista de camas por espacio (recámara 1, 2…, altillo/tapanco u otro), igual
// que en el formulario del anfitrión. Manda los mismos campos ocultos
// (bed_room_type, bed_room_number, bed_type, bed_quantity) para que el servidor
// los guarde en property_beds; es lo que se muestra en la página de la cabaña.
import { useState } from 'react'
import { uuid } from '@/lib/uuid'

export type BedValue = {
  room_type: 'recamara' | 'altillo_tapanco' | 'otro'
  room_number?: number | null
  bed_type: string
  quantity: number
}

export const BED_TYPE_LABELS: Record<string, string> = {
  individual: 'Individual',
  matrimonial: 'Matrimonial',
  queen: 'Queen',
  king: 'King',
  litera: 'Litera',
  cuna: 'Cuna',
  sofa_cama: 'Sofá cama',
}

const MAX_ROOMS = 12
const OTHER_SPACES: Record<string, string> = { altillo_tapanco: 'Altillo / Tapanco', otro: 'Otro espacio' }

type Row = BedValue & { _key: string }

function spaceValue(r: Pick<BedValue, 'room_type' | 'room_number'>) {
  return r.room_type === 'recamara' ? `recamara:${r.room_number ?? 1}` : r.room_type
}
function parseSpace(v: string): Pick<BedValue, 'room_type' | 'room_number'> {
  if (v.startsWith('recamara:')) return { room_type: 'recamara', room_number: Number(v.slice(9)) || 1 }
  return { room_type: v as BedValue['room_type'], room_number: null }
}

export default function BedsEditor({
  initial,
  inputClass,
  labelClass,
}: {
  initial: BedValue[]
  inputClass: string
  labelClass: string
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial.length > 0
      ? initial.map((b) => ({ ...b, _key: uuid() }))
      : [{ room_type: 'recamara', room_number: 1, bed_type: 'matrimonial', quantity: 1, _key: uuid() }]
  )
  const update = (key: string, patch: Partial<BedValue>) =>
    setRows((rs) => rs.map((r) => (r._key === key ? { ...r, ...patch } : r)))

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row._key} className="grid grid-cols-[1fr_1fr_72px_auto] gap-2 items-end">
          <input type="hidden" name="bed_room_type" value={row.room_type} readOnly />
          <input type="hidden" name="bed_room_number" value={row.room_number ?? ''} readOnly />
          <input type="hidden" name="bed_type" value={row.bed_type} readOnly />
          <input type="hidden" name="bed_quantity" value={row.quantity} readOnly />
          <label>
            <span className={labelClass}>Espacio</span>
            <select value={spaceValue(row)} onChange={(e) => update(row._key, parseSpace(e.target.value))} className={inputClass}>
              {Array.from({ length: MAX_ROOMS }, (_, i) => (
                <option key={i} value={`recamara:${i + 1}`}>
                  Recámara {i + 1}
                </option>
              ))}
              {Object.entries(OTHER_SPACES).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClass}>Tipo de cama</span>
            <select value={row.bed_type} onChange={(e) => update(row._key, { bed_type: e.target.value })} className={inputClass}>
              {Object.entries(BED_TYPE_LABELS).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
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
              onChange={(e) => update(row._key, { quantity: Number(e.target.value) || 1 })}
              className={inputClass}
            />
          </label>
          <button
            type="button"
            onClick={() => setRows((rs) => rs.filter((r) => r._key !== row._key))}
            className="px-2 py-2 text-xs text-burnt-orange"
          >
            Quitar
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          setRows((rs) => {
            // La fila nueva arranca en el mismo espacio que la última: agregar
            // otro tipo de cama a esa recámara es un solo clic.
            const last = rs[rs.length - 1]
            return [
              ...rs,
              {
                room_type: last?.room_type ?? 'recamara',
                room_number: last ? (last.room_number ?? null) : 1,
                bed_type: 'matrimonial',
                quantity: 1,
                _key: uuid(),
              },
            ]
          })
        }
        className="text-sm text-gold underline underline-offset-2"
      >
        + Agregar cama
      </button>
    </div>
  )
}
