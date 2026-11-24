import Link from 'next/link'
import { requireHost } from '@/lib/hosts'
import { createServiceClient } from '@/lib/supabase/service'
import { todayInMexicoStr } from '@/lib/dates'
import { mxn, type Partner } from '@/lib/partners'
import { SITE_URL } from '@/lib/site'
import { AccountStatusButton, ApproveButton, DeletePartnerButton, PartnerPricingRow, PayoutButton, VerifyBankButton } from './SociosControls'

export const dynamic = 'force-dynamic'

const STATE: Record<string, string> = { review: 'En revisión', active: 'Publicada', paused: 'Pausada', removed: 'Quitada' }

function fmt(d: string) {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}
function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export default async function SociosAdminPage() {
  await requireHost()
  const service = createServiceClient()
  const today = todayInMexicoStr()

  const [{ data: partners }, { data: properties }, { data: pending }, { data: paid }] = await Promise.all([
    service.from('partners').select('*').order('created_at', { ascending: false }),
    service
      .from('properties')
      .select('id, name, slug, partner_id, partner_state, partner_price_weekday, partner_price_weekend, weekday_price_mxn, weekend_price_mxn, min_nights, created_at, partner_markup_pct, partner_fee_pct, admin_rating, price_tier')
      .not('partner_id', 'is', null)
      .order('created_at'),
    service
      .from('bookings')
      .select('id, check_in, check_out, guest_name, total_price_mxn, partner_id, partner_payout_mxn, properties(name)')
      .not('partner_id', 'is', null)
      .eq('status', 'confirmed')
      .is('partner_paid_at', null)
      .order('check_in'),
    service
      .from('bookings')
      .select('id, check_in, check_out, guest_name, partner_id, partner_payout_mxn, partner_paid_at, partner_paid_ref, properties(name)')
      .not('partner_id', 'is', null)
      .not('partner_paid_at', 'is', null)
      .order('partner_paid_at', { ascending: false })
      .limit(30),
  ])

  const byId = new Map((partners ?? []).map((p) => [p.id as string, p as Partner]))
  const review = (properties ?? []).filter((p) => p.partner_state === 'review')

  // Comprobantes bancarios: liga temporal (1 hora) porque el bucket es privado.
  const proofLinks = new Map<string, string>()
  await Promise.all(
    (partners ?? [])
      .filter((p) => p.bank_proof_path)
      .map(async (p) => {
        const { data } = await service.storage.from('partner-docs').createSignedUrl(p.bank_proof_path as string, 3600)
        if (data?.signedUrl) proofLinks.set(p.id as string, data.signedUrl)
      })
  )

  const card = 'rounded-2xl border border-stone/15 bg-white p-5'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy-deep">Socios</h1>
        <p className="text-sm text-stone mt-1">
          Cabañas de terceros publicadas en tu sitio. Liga de registro para invitarlos:{' '}
          <span className="font-mono text-navy-deep">{SITE_URL}/socios/registro</span>
        </p>
      </div>

      <section className={card}>
        <h2 className="font-medium text-navy-deep mb-3">Cabañas por revisar ({review.length})</h2>
        {review.length === 0 ? (
          <p className="text-sm text-stone">No hay cabañas pendientes.</p>
        ) : (
          <ul className="space-y-3">
            {review.map((p) => {
              const partner = byId.get(p.partner_id as string)
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-stone/10 pt-3 first:border-0 first:pt-0">
                  <div className="text-sm">
                    <p className="font-medium text-navy-deep">{p.name}</p>
                    <p className="text-xs text-stone">
                      {partner?.name} · socio ${Number(p.partner_price_weekday).toLocaleString('es-MX')} / $
                      {Number(p.partner_price_weekend).toLocaleString('es-MX')} → huésped ${Number(p.weekday_price_mxn).toLocaleString('es-MX')} / $
                      {Number(p.weekend_price_mxn).toLocaleString('es-MX')} · mín. {p.min_nights} noche(s)
                    </p>
                    {!partner?.bank_verified_at && <p className="text-xs text-burnt-orange">Sus datos de pago aún no están verificados.</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/propiedades/${p.id}`} className="text-xs text-navy-deep underline underline-offset-2">
                      Revisar / editar
                    </Link>
                    <ApproveButton propertyId={p.id as string} />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className="font-medium text-navy-deep mb-1">Precios, calificación y tipo</h2>
        <p className="text-xs text-stone mb-3">
          Aquí ves el precio que puso cada socio y decides tu margen al huésped. El socio no ve esto: en su panel solo ve su precio y lo
          que recibe, y su pago siempre sale de su precio. Si el socio cambia su precio, se respeta tu margen. La calificación se muestra
          en el sitio y el tipo sirve para el filtro del buscador.
        </p>
        {(properties ?? []).filter((p) => p.partner_state !== 'removed').length === 0 ? (
          <p className="text-sm text-stone">Todavía no hay cabañas de socios.</p>
        ) : (
          <div className="space-y-3">
            {(properties ?? [])
              .filter((p) => p.partner_state !== 'removed')
              .map((p) => (
                <PartnerPricingRow
                  key={p.id as string}
                  propertyId={p.id as string}
                  name={p.name as string}
                  partnerName={byId.get(p.partner_id as string)?.name ?? 'socio'}
                  state={STATE[p.partner_state as string] ?? (p.partner_state as string)}
                  partnerWeekday={Number(p.partner_price_weekday)}
                  partnerWeekend={Number(p.partner_price_weekend)}
                  feePct={Number(p.partner_fee_pct ?? 5)}
                  markupPct={Number(p.partner_markup_pct ?? 14)}
                  rating={p.admin_rating == null ? null : Number(p.admin_rating)}
                  tier={(p.price_tier as string | null) ?? null}
                />
              ))}
          </div>
        )}
      </section>

      <section className={card}>
        <h2 className="font-medium text-navy-deep mb-1">Pagos a socios pendientes</h2>
        <p className="text-xs text-stone mb-3">Se pagan al día siguiente del check-in. Los marcados en naranja ya tocan.</p>
        {(pending ?? []).length === 0 ? (
          <p className="text-sm text-stone">No hay pagos pendientes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-stone">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">Pagar el</th>
                  <th className="py-1.5 pr-3 font-medium">Cabaña / huésped</th>
                  <th className="py-1.5 pr-3 font-medium">Monto</th>
                  <th className="py-1.5 pr-3 font-medium">Cuenta</th>
                  <th className="py-1.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {(pending ?? []).map((b) => {
                  const partner = byId.get(b.partner_id as string)
                  const due = addDays(b.check_in as string, 1)
                  const prop = Array.isArray(b.properties) ? b.properties[0] : b.properties
                  return (
                    <tr key={b.id} className="border-t border-stone/10 align-top">
                      <td className={`py-2 pr-3 whitespace-nowrap ${due <= today ? 'text-burnt-orange font-medium' : ''}`}>{fmt(due)}</td>
                      <td className="py-2 pr-3">
                        {prop?.name}
                        <span className="block text-xs text-stone">
                          {b.guest_name} · {fmt(b.check_in as string)} → {fmt(b.check_out as string)} · cobrado {mxn(Number(b.total_price_mxn))}
                        </span>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap font-medium">{mxn(Number(b.partner_payout_mxn ?? 0))}</td>
                      <td className="py-2 pr-3 text-xs">
                        {partner?.bank_clabe ? (
                          <>
                            {partner.bank_holder} · {partner.bank_name}
                            <span className="block font-mono">{partner.bank_clabe}</span>
                            {!partner.bank_verified_at && <span className="text-burnt-orange">Sin verificar</span>}
                          </>
                        ) : (
                          <span className="text-burnt-orange">Sin datos de pago</span>
                        )}
                      </td>
                      <td className="py-2">
                        <PayoutButton bookingId={b.id as string} paid={false} amount={mxn(Number(b.partner_payout_mxn ?? 0))} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={card}>
        <h2 className="font-medium text-navy-deep mb-3">Socios ({(partners ?? []).length})</h2>
        {(partners ?? []).length === 0 ? (
          <p className="text-sm text-stone">Todavía no se registra ningún socio.</p>
        ) : (
          <ul className="space-y-4">
            {(partners ?? []).map((p) => {
              const props = (properties ?? []).filter((x) => x.partner_id === p.id)
              return (
                <li key={p.id} className="border-t border-stone/10 pt-4 first:border-0 first:pt-0 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-navy-deep">
                      {p.name}{' '}
                      {p.status === 'suspended' && <span className="ml-1 rounded-full bg-burnt-orange/15 px-2 py-0.5 text-xs text-burnt-orange">Suspendido</span>}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <AccountStatusButton partnerId={p.id as string} status={p.status as string} />
                      <DeletePartnerButton partnerId={p.id as string} name={p.name as string} />
                    </div>
                  </div>
                  <p className="text-xs text-stone">
                    {p.email} · {p.phone} · registrado {fmt(String(p.created_at).slice(0, 10))}
                  </p>
                  <div className="rounded-xl bg-cream/60 p-3 text-xs space-y-1">
                    {p.bank_clabe ? (
                      <>
                        <p>
                          <strong>Titular:</strong> {p.bank_holder} · <strong>Banco:</strong> {p.bank_name ?? '—'} · <strong>CLABE:</strong>{' '}
                          <span className="font-mono">{p.bank_clabe}</span>
                          {p.bank_rfc ? ` · RFC ${p.bank_rfc}` : ''}
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                          {proofLinks.get(p.id as string) && (
                            <a href={proofLinks.get(p.id as string)} target="_blank" className="text-navy-deep underline underline-offset-2">
                              Ver comprobante
                            </a>
                          )}
                          <span className={p.bank_verified_at ? 'text-emerald-700' : 'text-burnt-orange'}>
                            {p.bank_verified_at ? '✅ Verificada' : 'Sin verificar'}
                          </span>
                          <VerifyBankButton partnerId={p.id as string} verified={Boolean(p.bank_verified_at)} />
                        </div>
                      </>
                    ) : (
                      <p className="text-burnt-orange">No ha registrado sus datos de pago.</p>
                    )}
                  </div>
                  {props.length > 0 && (
                    <ul className="text-xs text-navy-deep space-y-0.5">
                      {props.map((x) => (
                        <li key={x.id}>
                          <Link href={`/admin/propiedades/${x.id}`} className="underline underline-offset-2">
                            {x.name}
                          </Link>{' '}
                          · {STATE[x.partner_state as string] ?? x.partner_state}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {(paid ?? []).length > 0 && (
        <section className={card}>
          <h2 className="font-medium text-navy-deep mb-3">Pagos hechos recientemente</h2>
          <ul className="space-y-1.5 text-sm">
            {(paid ?? []).map((b) => {
              const prop = Array.isArray(b.properties) ? b.properties[0] : b.properties
              return (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-stone/10 pt-1.5 first:border-0">
                  <span>
                    {mxn(Number(b.partner_payout_mxn ?? 0))} · {byId.get(b.partner_id as string)?.name} · {prop?.name} ({fmt(b.check_in as string)})
                    <span className="block text-xs text-stone">
                      Pagado {new Date(b.partner_paid_at as string).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' })}
                      {b.partner_paid_ref ? ` · ref. ${b.partner_paid_ref}` : ''}
                    </span>
                  </span>
                  <PayoutButton bookingId={b.id as string} paid amount="" />
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
