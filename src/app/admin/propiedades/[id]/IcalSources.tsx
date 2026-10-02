'use client'

import { useState, useTransition } from 'react'
import ConfirmSubmitButton from '@/components/ConfirmSubmitButton'
import { addIcalSource, deleteIcalSource, syncIcalSource, syncAllIcalSources } from '../ical-actions'

export type IcalSourceRecord = {
  id: string
  label: string
  platform: string
  ical_url_import: string
  last_synced_at: string | null
}

const inputClass =
  'w-full rounded-lg border border-stone/30 bg-white px-3 py-2 text-sm text-navy-deep placeholder:text-stone/50 focus:outline-none focus:ring-2 focus:ring-gold'
const labelClass = 'block text-xs font-medium text-stone mb-1'

function formatSynced(iso: string | null) {
  if (!iso) return 'Nunca sincronizado'
  return `Última sincronización: ${new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}`
}

export default function IcalSources({
  propertyId,
  sources,
  exportUrl,
}: {
  propertyId: string
  sources: IcalSourceRecord[]
  exportUrl: string
}) {
  const [isPending, startTransition] = useTransition()
  const [showAdd, setShowAdd] = useState(false)
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  // Si Airbnb/Booking se quedó con fechas bloqueadas que ya no existen de
  // nuestro lado (p. ej. canceladas), a veces no las suelta aunque el
  // calendario que le mandamos ya esté correcto — hay que darle un enlace
  // "nuevo" para que lo trate como una fuente distinta y vuelva a importar
  // todo desde cero. Como la ruta de export ignora cualquier parámetro extra
  // en la URL, agregar `?v=...` no cambia nada de nuestro lado — solo hace
  // que Airbnb/Booking lo vean como un link diferente.
  const [regenToken, setRegenToken] = useState<string | null>(null)
  const effectiveExportUrl = regenToken ? `${exportUrl}?v=${regenToken}` : exportUrl

  function regenerateLink() {
    setRegenToken(String(Date.now()))
    setCopied(false)
  }

  function handleAdd() {
    setError(null)
    if (!label.trim() || !url.trim()) {
      setError('Falta el nombre o la URL.')
      return
    }
    const fd = new FormData()
    fd.set('label', label)
    fd.set('url', url)
    startTransition(async () => {
      const res = await addIcalSource(propertyId, fd)
      if (res?.error) setError(res.error)
      else {
        setLabel('')
        setUrl('')
        setShowAdd(false)
      }
    })
  }

  function handleSyncOne(sourceId: string) {
    setSyncingId(sourceId)
    startTransition(async () => {
      const res = await syncIcalSource(propertyId, sourceId)
      if (res?.error) setError(res.error)
      setSyncingId(null)
    })
  }

  function handleSyncAll() {
    setError(null)
    setSyncingId('__all__')
    startTransition(async () => {
      const res = await syncAllIcalSources(propertyId)
      if (res?.error) setError(res.error)
      setSyncingId(null)
    })
  }

  async function copyExportLink() {
    try {
      await navigator.clipboard.writeText(effectiveExportUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // el navegador puede negar el acceso al portapapeles; no es crítico
    }
  }

  return (
    <div className="rounded-xl border border-stone/15 bg-white p-5 space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-navy-deep uppercase tracking-wide mb-1">
          Sincronización con calendarios externos (iCal)
        </h2>
        <p className="text-xs text-stone">
          Importa el calendario de Airbnb, Booking o cualquier otra plataforma para que esas fechas se
          bloqueen aquí solas. Puedes agregar los que necesites, sin límite.
        </p>
      </div>

      <div>
        <span className={labelClass}>Enlace para exportar (dáselo a Airbnb/Booking)</span>
        <div className="flex gap-2">
          <input
            readOnly
            value={effectiveExportUrl}
            className={`${inputClass} text-xs`}
            onFocus={(e) => e.target.select()}
          />
          <button
            type="button"
            onClick={copyExportLink}
            className="shrink-0 rounded-lg border border-stone/30 px-3 py-2 text-xs font-medium text-navy-deep hover:bg-cream"
          >
            {copied ? 'Copiado' : 'Copiar'}
          </button>
          <button
            type="button"
            onClick={regenerateLink}
            title="Genera un enlace nuevo para que Airbnb/Booking lo trate como una fuente distinta y reimporte todo desde cero — úsalo si una plataforma se quedó con fechas bloqueadas que ya liberaste de este lado."
            className="shrink-0 rounded-lg border border-stone/30 px-3 py-2 text-xs font-medium text-navy-deep hover:bg-cream"
          >
            Regenerar enlace
          </button>
        </div>
        {regenToken && (
          <p className="text-[11px] text-stone mt-1">
            Enlace nuevo generado. Pégalo en Airbnb/Booking quitando primero el calendario viejo que tenían
            vinculado (si no lo quitas, van a ver dos fuentes distintas).
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className={labelClass}>Calendarios importados</span>
          {sources.length > 0 && (
            <button
              type="button"
              onClick={handleSyncAll}
              disabled={isPending}
              className="text-xs text-gold underline underline-offset-2 disabled:opacity-50"
            >
              {syncingId === '__all__' ? 'Actualizando…' : 'Actualizar todos'}
            </button>
          )}
        </div>

        {sources.length === 0 ? (
          <p className="text-sm text-stone">Aún no importas ningún calendario externo.</p>
        ) : (
          <div className="space-y-2">
            {sources.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-stone/15 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy-deep truncate">{s.label}</p>
                  <p className="text-xs text-stone truncate">{s.ical_url_import}</p>
                  <p className="text-[11px] text-stone/70">{formatSynced(s.last_synced_at)}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-xs">
                  <button
                    type="button"
                    onClick={() => handleSyncOne(s.id)}
                    disabled={isPending}
                    className="text-gold underline underline-offset-2 disabled:opacity-50"
                  >
                    {syncingId === s.id ? 'Actualizando…' : 'Actualizar'}
                  </button>
                  <form action={deleteIcalSource.bind(null, propertyId, s.id)}>
                    <ConfirmSubmitButton
                      confirmMessage={`¿Quitar el calendario "${s.label}"? Las fechas que había bloqueado se liberan.`}
                      className="text-burnt-orange hover:underline"
                    >
                      Quitar
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-burnt-orange">{error}</p>}

      {showAdd ? (
        <div className="space-y-3 rounded-lg border border-stone/15 p-4">
          <label>
            <span className={labelClass}>Nombre del calendario</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Airbnb, Booking, Titanshub…"
              className={inputClass}
            />
          </label>
          <label>
            <span className={labelClass}>URL de iCal</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.airbnb.mx/calendar/ical/..."
              className={inputClass}
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleAdd}
              disabled={isPending}
              className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-cream hover:bg-navy-deep transition disabled:opacity-60"
            >
              {isPending ? 'Agregando…' : 'Agregar calendario'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAdd(false)
                setError(null)
              }}
              className="text-sm text-stone hover:text-navy-deep"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="text-sm font-medium text-gold underline underline-offset-2"
        >
          + Agregar URL de iCal
        </button>
      )}
    </div>
  )
}
