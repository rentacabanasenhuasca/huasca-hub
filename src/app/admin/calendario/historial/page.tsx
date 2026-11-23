import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireHost } from '@/lib/hosts'

// Historial de movimientos del calendario: cada bloqueo y desbloqueo (manual,
// de colaboradores o por reserva) con fecha, hora y quién lo hizo. Lo llena
// un trigger en la base (calendar_block_log). Las sincronizaciones de
// Airbnb/Booking no aparecen aquí.
export const dynamic = 'force-dynamic'

const ACTION: Record<string, { label: string; cls: string }> = {
  bloqueo: { label: 'Bloqueo', cls: 'bg-burnt-orange/15 text-burnt-orange' },
  desbloqueo: { label: 'Desbloqueo', cls: 'bg-emerald-100 text-emerald-700' },
  cambio: { label: 'Cambio', cls: 'bg-stone/10 text-stone' },
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function fmtNight(d: string) {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString('es-MX', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ propiedad?: string; noche?: string; quien?: string }>
}) {
  const host = await requireHost()
  const supabase = await createClient()
  const sp = await searchParams

  const { data: properties } = await supabase
    .from('properties')
    .select('id, name')
    .eq('host_id', host.id)
    .order('name')
  const names = new Map((properties ?? []).map((p) => [p.id as string, p.name as string]))

  let q = supabase
    .from('calendar_block_log')
    .select('id, created_at, property_id, date, action, source, note, actor')
    .order('created_at', { ascending: false })
    .limit(400)
  if (sp.propiedad) q = q.eq('property_id', sp.propiedad)
  if (sp.noche) q = q.eq('date', sp.noche)
  if (sp.quien === 'manual') q = q.eq('source', 'manual')
  if (sp.quien === 'reservas') q = q.eq('source', 'booking')
  const { data: entries, error } = await q

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/calendario" className="text-xs text-stone hover:text-navy-deep">
          ← Calendario
        </Link>
        <h1 className="text-xl font-semibold text-navy-deep mt-1">Historial de movimientos</h1>
        <p className="text-sm text-stone mt-1">
          Cada bloqueo y desbloqueo del calendario, con la fecha y hora en que se hizo y quién lo hizo. No incluye
          las sincronizaciones automáticas de Airbnb/Booking.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-stone/15 bg-white p-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-stone">Cabaña</span>
          <select name="propiedad" defaultValue={sp.propiedad ?? ''} className="rounded-lg border border-stone/30 px-2 py-1.5">
            <option value="">Todas</option>
            {(properties ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-stone">Noche</span>
          <input type="date" name="noche" defaultValue={sp.noche ?? ''} className="rounded-lg border border-stone/30 px-2 py-1.5" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-stone">Tipo</span>
          <select name="quien" defaultValue={sp.quien ?? ''} className="rounded-lg border border-stone/30 px-2 py-1.5">
            <option value="">Todos</option>
            <option value="manual">Bloqueos manuales</option>
            <option value="reservas">Reservas</option>
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-navy-deep px-3 py-1.5 text-cream">
          Filtrar
        </button>
        {(sp.propiedad || sp.noche || sp.quien) && (
          <Link href="/admin/calendario/historial" className="text-xs text-stone underline underline-offset-2">
            Quitar filtros
          </Link>
        )}
      </form>

      {error ? (
        <p className="text-sm text-burnt-orange">No se pudo cargar el historial: {error.message}</p>
      ) : !entries || entries.length === 0 ? (
        <p className="text-sm text-stone">No hay movimientos con esos filtros.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone/15 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-cream/60 text-left text-xs text-stone">
              <tr>
                <th className="px-3 py-2 font-medium">Cuándo</th>
                <th className="px-3 py-2 font-medium">Movimiento</th>
                <th className="px-3 py-2 font-medium">Cabaña</th>
                <th className="px-3 py-2 font-medium">Noche</th>
                <th className="px-3 py-2 font-medium">Quién</th>
                <th className="px-3 py-2 font-medium">Nota</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const a = ACTION[e.action as string] ?? { label: e.action, cls: 'bg-stone/10 text-stone' }
                return (
                  <tr key={e.id} className="border-t border-stone/10">
                    <td className="px-3 py-2 whitespace-nowrap text-navy-deep">{fmtTime(e.created_at as string)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.cls}`}>{a.label}</span>
                      {e.source === 'booking' && <span className="ml-1 text-xs text-stone">(reserva)</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{names.get(e.property_id as string) ?? '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtNight(e.date as string)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{e.actor ?? '—'}</td>
                    <td className="px-3 py-2 text-stone">{e.note ?? ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {entries.length === 400 && (
            <p className="px-3 py-2 text-xs text-stone">Mostrando los 400 movimientos más recientes. Usa los filtros para ver más atrás.</p>
          )}
        </div>
      )}
    </div>
  )
}
