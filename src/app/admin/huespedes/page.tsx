import { createClient } from '@/lib/supabase/server'
import { requireHost } from '@/lib/hosts'
import { getGuestAnalytics } from '@/lib/guest-analytics'

function money(n: number) {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
}

export default async function HuespedesPage() {
  const host = await requireHost()
  const supabase = await createClient()

  const { guests, topProperties, bySource, totalRevenue, totalBookings, repeatGuests, avgSpendPerGuest } =
    await getGuestAnalytics(supabase, host.id)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-navy-deep">Huéspedes</h1>
          <p className="text-sm text-stone mt-1">
            Base de datos de todas las personas que han reservado, con su historial y gasto — y un resumen general
            del negocio.
          </p>
        </div>
        {/* Descargas — cada link es una ruta que arma el CSV al vuelo y lo
            manda con Content-Disposition: attachment, así el navegador lo
            descarga directo sin pasar por ningún estado de React. */}
        <div className="flex flex-wrap gap-2">
          <a
            href="/admin/huespedes/export/guests"
            className="rounded-full border border-stone/25 bg-white px-4 py-2 text-xs font-medium text-navy-deep hover:border-gold hover:bg-gold/5 transition"
          >
            ⬇ Huéspedes (CSV)
          </a>
          <a
            href="/admin/huespedes/export/reservas"
            className="rounded-full border border-stone/25 bg-white px-4 py-2 text-xs font-medium text-navy-deep hover:border-gold hover:bg-gold/5 transition"
          >
            ⬇ Todas las reservas (CSV)
          </a>
          <a
            href="/admin/huespedes/export/analisis"
            className="rounded-full border border-stone/25 bg-white px-4 py-2 text-xs font-medium text-navy-deep hover:border-gold hover:bg-gold/5 transition"
          >
            ⬇ Análisis (CSV)
          </a>
        </div>
      </div>

      {/* Resumen general */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Ingresos totales" value={money(totalRevenue)} />
        <StatCard label="Reservas confirmadas" value={String(totalBookings)} />
        <StatCard label="Huéspedes únicos" value={String(guests.length)} />
        <StatCard label="Huéspedes recurrentes" value={String(repeatGuests)} />
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <div className="rounded-xl border border-stone/15 bg-white p-4">
          <h2 className="text-sm font-semibold text-navy-deep mb-3">Ingresos por cabaña</h2>
          {topProperties.length === 0 ? (
            <p className="text-sm text-stone">Todavía no hay reservas confirmadas.</p>
          ) : (
            <div className="space-y-2">
              {topProperties.map((p) => (
                <div key={p.name} className="flex items-center justify-between text-sm">
                  <span className="text-navy-deep">{p.name}</span>
                  <span className="text-stone">
                    {money(p.revenue)} · {p.bookings} reserva{p.bookings === 1 ? '' : 's'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-stone/15 bg-white p-4">
          <h2 className="text-sm font-semibold text-navy-deep mb-3">De dónde vienen las reservas</h2>
          {bySource.size === 0 ? (
            <p className="text-sm text-stone">Todavía no hay reservas confirmadas.</p>
          ) : (
            <div className="space-y-2">
              {[...bySource.entries()].map(([source, count]) => (
                <div key={source} className="flex items-center justify-between text-sm">
                  <span className="text-navy-deep capitalize">
                    {source === 'direct' ? 'Directo (este sitio)' : source}
                  </span>
                  <span className="text-stone">{count}</span>
                </div>
              ))}
              <p className="text-xs text-stone/70 pt-1">
                Gasto promedio por huésped: {money(avgSpendPerGuest)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Lista de huéspedes */}
      <h2 className="text-sm font-semibold text-navy-deep mb-3">Todos los huéspedes ({guests.length})</h2>
      {guests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone/30 bg-white p-10 text-center text-stone">
          Todavía no hay reservas registradas.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone/15 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone/15 text-left text-xs text-stone">
                <th className="px-4 py-3 font-medium">Huésped</th>
                <th className="px-4 py-3 font-medium">Contacto</th>
                <th className="px-4 py-3 font-medium">Cabañas</th>
                <th className="px-4 py-3 font-medium">Reservas</th>
                <th className="px-4 py-3 font-medium">Gastado</th>
                <th className="px-4 py-3 font-medium">Última estancia</th>
              </tr>
            </thead>
            <tbody>
              {guests.map((g) => (
                <tr key={g.key} className="border-b border-stone/10 last:border-0">
                  <td className="px-4 py-3 text-navy-deep font-medium">
                    {g.name}
                    {g.bookingsCount > 1 && (
                      <span className="ml-2 rounded-full bg-gold/15 text-gold px-2 py-0.5 text-[10px] font-semibold">
                        Recurrente
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-stone">
                    {g.email && <div>{g.email}</div>}
                    {g.phone && <div>{g.phone}</div>}
                    {!g.email && !g.phone && '—'}
                  </td>
                  <td className="px-4 py-3 text-stone">{[...g.properties].join(', ')}</td>
                  <td className="px-4 py-3 text-stone">
                    {g.bookingsCount}
                    {g.cancelledCount > 0 && (
                      <span className="text-xs text-stone/60"> ({g.cancelledCount} cancelada{g.cancelledCount === 1 ? '' : 's'})</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-navy-deep font-medium">{money(g.totalSpentMxn)}</td>
                  <td className="px-4 py-3 text-stone">{g.lastStay}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone/15 bg-white p-4">
      <p className="text-xs text-stone">{label}</p>
      <p className="text-lg font-semibold text-navy-deep mt-1">{value}</p>
    </div>
  )
}
