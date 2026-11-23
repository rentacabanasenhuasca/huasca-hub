import Link from 'next/link'
import { requirePartner, mxn } from '@/lib/partners'
import { createServiceClient } from '@/lib/supabase/service'
import { todayInMexicoStr } from '@/lib/dates'
import StateButtons from './cabana/StateButtons'

export const dynamic = 'force-dynamic'

const STATE: Record<string, { label: string; cls: string }> = {
  review: { label: 'En revisión', cls: 'bg-gold/20 text-navy-deep' },
  active: { label: 'Publicada', cls: 'bg-emerald-100 text-emerald-700' },
  paused: { label: 'Pausada', cls: 'bg-stone/15 text-stone' },
  removed: { label: 'Quitada', cls: 'bg-burnt-orange/15 text-burnt-orange' },
}

function fmt(d: string) {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export default async function SociosHome({ searchParams }: { searchParams: Promise<{ bienvenido?: string }> }) {
  const partner = await requirePartner()
  const { bienvenido } = await searchParams
  const service = createServiceClient()
  const today = todayInMexicoStr()

  const [{ data: properties }, { data: bookings }] = await Promise.all([
    service
      .from('properties')
      .select('id, name, slug, partner_state, status, partner_price_weekday, partner_price_weekend, min_nights, property_photos(url, sort_order)')
      .eq('partner_id', partner.id)
      .order('created_at'),
    service
      .from('bookings')
      .select('id, check_in, check_out, guest_name, adults, children, infants, status, partner_payout_mxn, partner_paid_at, properties(name)')
      .eq('partner_id', partner.id)
      .gte('check_out', addDays(today, -60))
      .order('check_in'),
  ])

  const bankOk = Boolean(partner.bank_clabe && partner.bank_proof_path)

  return (
    <div className="space-y-6">
      {bienvenido && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800">
          ¡Bienvenido! Tu cuenta quedó creada. Sigue estos pasos: registra tu cabaña, llena tus datos de pago y conecta tu calendario.
        </div>
      )}

      <section className="rounded-2xl border border-stone/15 bg-white p-5">
        <h2 className="font-medium text-navy-deep mb-2">Datos de pago</h2>
        {!bankOk ? (
          <p className="text-sm text-stone">
            Todavía no registras tu cuenta para recibir pagos.{' '}
            <Link href="/socios/datos" className="text-navy-deep underline underline-offset-2">Registrarla</Link>
          </p>
        ) : partner.bank_verified_at ? (
          <p className="text-sm text-emerald-700">✅ Cuenta verificada: {partner.bank_name ?? 'banco'} terminación {partner.bank_clabe!.slice(-4)}.</p>
        ) : (
          <p className="text-sm text-stone">⏳ Recibimos tus datos ({partner.bank_name ?? 'banco'} terminación {partner.bank_clabe!.slice(-4)}). Los estamos verificando.</p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-navy-deep">Mis cabañas</h1>
          <Link href="/socios/cabana/nueva" className="rounded-full bg-navy-deep px-4 py-2 text-sm text-cream hover:bg-navy-deep/90">
            + Registrar cabaña
          </Link>
        </div>
        {(properties ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-stone/30 bg-white p-6 text-center text-sm text-stone">
            Aún no registras ninguna cabaña.
          </p>
        ) : (
          (properties ?? []).map((p) => {
            const photos = ((p.property_photos as { url: string; sort_order: number }[] | null) ?? []).sort((a, b) => a.sort_order - b.sort_order)
            const st = STATE[p.partner_state as string] ?? STATE.review
            return (
              <div key={p.id} className="rounded-2xl border border-stone/15 bg-white p-4 flex flex-col sm:flex-row gap-4">
                {photos[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photos[0].url} alt="" className="h-28 w-full sm:w-40 rounded-xl object-cover" />
                )}
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-navy-deep">{p.name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                  </div>
                  <p className="text-xs text-stone">
                    Tu precio: ${Number(p.partner_price_weekday).toLocaleString('es-MX')} entre semana · $
                    {Number(p.partner_price_weekend).toLocaleString('es-MX')} fin de semana · mínimo {p.min_nights} noche(s)
                  </p>
                  {p.partner_state === 'active' && (
                    <a href={`/cabanas/${p.slug}`} target="_blank" className="text-xs text-navy-deep underline underline-offset-2">
                      Ver en el sitio
                    </a>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {p.partner_state !== 'removed' && (
                      <>
                        <Link href={`/socios/cabana/${p.id}`} className="rounded-lg border border-stone/25 px-3 py-1.5 text-xs text-navy-deep hover:border-gold">
                          Editar
                        </Link>
                        <Link href={`/socios/cabana/${p.id}/calendario`} className="rounded-lg border border-stone/25 px-3 py-1.5 text-xs text-navy-deep hover:border-gold">
                          Calendario
                        </Link>
                      </>
                    )}
                    <StateButtons propertyId={p.id} state={p.partner_state as string} />
                  </div>
                </div>
              </div>
            )
          })
        )}
      </section>

      <section className="rounded-2xl border border-stone/15 bg-white p-5">
        <h2 className="font-medium text-navy-deep mb-3">Reservas</h2>
        {(bookings ?? []).length === 0 ? (
          <p className="text-sm text-stone">Aún no hay reservas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-stone">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">Cabaña</th>
                  <th className="py-1.5 pr-3 font-medium">Fechas</th>
                  <th className="py-1.5 pr-3 font-medium">Huésped</th>
                  <th className="py-1.5 pr-3 font-medium">Recibes</th>
                  <th className="py-1.5 font-medium">Pago</th>
                </tr>
              </thead>
              <tbody>
                {(bookings ?? []).map((b) => {
                  const prop = Array.isArray(b.properties) ? b.properties[0] : b.properties
                  const cancelled = b.status !== 'confirmed'
                  return (
                    <tr key={b.id} className="border-t border-stone/10">
                      <td className="py-2 pr-3">{prop?.name}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{fmt(b.check_in)} → {fmt(b.check_out)}</td>
                      <td className="py-2 pr-3">
                        {b.guest_name} · {b.adults + (b.children ?? 0)} pers.{b.infants ? ` + ${b.infants} bebé(s)` : ''}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">{cancelled ? '—' : mxn(Number(b.partner_payout_mxn ?? 0))}</td>
                      <td className="py-2 whitespace-nowrap text-xs">
                        {cancelled ? (
                          <span className="text-burnt-orange">Cancelada</span>
                        ) : b.partner_paid_at ? (
                          <span className="text-emerald-700">Pagado {fmt(String(b.partner_paid_at).slice(0, 10))}</span>
                        ) : (
                          <span className="text-stone">Se paga el {fmt(addDays(b.check_in, 1))}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-stone">
          Si reservas fechas por fuera (Airbnb, Booking, WhatsApp), bloquéalas en tu calendario el mismo día o conecta tu calendario externo. Si
          necesitas cancelar una reserva, escríbenos de inmediato: cancelar puede tener penalización (ver Términos).
        </p>
      </section>
    </div>
  )
}
