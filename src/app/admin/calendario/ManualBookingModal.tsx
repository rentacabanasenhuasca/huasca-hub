'use client'

import { useState } from 'react'
import { createManualBooking } from './actions'

type Property = { id: string; name: string }

// Reserva creada a mano desde el panel — para pagos en efectivo,
// transferencia, o algo que ya se cerró por WhatsApp y no pasó por Stripe ni
// Mercado Pago. Bloquea las fechas igual que cualquier otra reserva directa.
export default function ManualBookingModal({
  properties,
  defaultPropertyId,
  onClose,
  onCreated,
}: {
  properties: Property[]
  defaultPropertyId?: string
  onClose: () => void
  onCreated: () => void
}) {
  const [propertyId, setPropertyId] = useState(defaultPropertyId ?? properties[0]?.id ?? '')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)
  const [infants, setInfants] = useState(0)
  const [pets, setPets] = useState(false)
  const [totalPriceMxn, setTotalPriceMxn] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const res = await createManualBooking({
      propertyId,
      checkIn,
      checkOut,
      guestName,
      guestEmail,
      guestPhone,
      adults,
      children,
      infants,
      pets,
      totalPriceMxn: Number(totalPriceMxn),
      notes,
    })
    setSubmitting(false)
    if (res.error) {
      setError(res.error)
      return
    }
    onCreated()
  }

  const inputClass =
    'w-full rounded-lg border border-stone/30 px-3 py-2 text-sm text-navy-deep focus:outline-none focus:ring-2 focus:ring-gold/50'
  const labelClass = 'block text-xs font-medium text-stone mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg text-navy-deep">Nueva reserva manual</h2>
          <button type="button" onClick={onClose} className="text-stone hover:text-navy-deep text-sm">
            Cerrar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Cabaña</label>
            <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className={inputClass} required>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Llegada</label>
              <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass}>Salida</label>
              <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={inputClass} required />
            </div>
          </div>

          <div>
            <label className={labelClass}>Nombre del huésped</label>
            <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)} className={inputClass} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Correo (opcional)</label>
              <input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Teléfono (opcional)</label>
              <input type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Adultos</label>
              <input
                type="number"
                min={1}
                value={adults}
                onChange={(e) => setAdults(Math.max(1, Number(e.target.value)))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Niños</label>
              <input
                type="number"
                min={0}
                value={children}
                onChange={(e) => setChildren(Math.max(0, Number(e.target.value)))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Infantes</label>
              <input
                type="number"
                min={0}
                value={infants}
                onChange={(e) => setInfants(Math.max(0, Number(e.target.value)))}
                className={inputClass}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-navy-deep">
            <input type="checkbox" checked={pets} onChange={(e) => setPets(e.target.checked)} className="rounded border-stone/40" />
            Trae mascota
          </label>

          <div>
            <label className={labelClass}>Monto cobrado (MXN) — el total exacto que pagó</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={totalPriceMxn}
              onChange={(e) => setTotalPriceMxn(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className={labelClass}>Notas (opcional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
          </div>

          {error && <p className="text-sm text-burnt-orange">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-navy px-4 py-2.5 text-sm font-medium text-cream hover:bg-navy-deep transition disabled:opacity-50"
          >
            {submitting ? 'Creando…' : 'Crear reserva'}
          </button>
        </form>
      </div>
    </div>
  )
}
