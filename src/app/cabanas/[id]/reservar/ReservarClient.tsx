'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { GuestCounts } from '@/lib/occupancy'
import type { GuestInfo } from './booking-finalize'
import { createStripePaymentIntent, finalizeStripeBooking, createMercadoPagoPayment, validateDiscountCodeAction } from './checkout-actions'
import StripePaymentForm from './StripePaymentForm'
import MercadoPagoPaymentForm from './MercadoPagoPaymentForm'
import { trackMetaEvent } from '@/lib/meta-pixel'

type Provider = 'stripe' | 'mercadopago'

export type AddonOption = {
  id: string
  name: string
  description: string | null
  price_mxn: number
  unit: 'flat' | 'per_unit'
  max_quantity: number
  photo_url: string | null
}

export default function ReservarClient({
  propertyId,
  checkin,
  checkout,
  guests,
  baseTotal,
  addons,
  stripePublishableKey,
  mercadoPagoPublicKey,
}: {
  propertyId: string
  checkin: string
  checkout: string
  guests: GuestCounts
  baseTotal: number
  addons: AddonOption[]
  stripePublishableKey: string
  mercadoPagoPublicKey: string
}) {
  const router = useRouter()
  const [guestInfo, setGuestInfo] = useState<GuestInfo>({ name: '', email: '', phone: '', notes: '' })
  const [confirmed, setConfirmed] = useState(false)
  const [provider, setProvider] = useState<Provider | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Cantidad elegida por extra (0 = no agregado). Solo se manda
  // {addonId, quantity} al servidor — el precio mostrado aquí es solo para
  // que el huésped vea el total mientras elige; el que realmente se cobra
  // se vuelve a calcular en el servidor a partir del catálogo real.
  const [addonQuantities, setAddonQuantities] = useState<Record<string, number>>({})

  // Cupón de descuento: el huésped escribe un código y lo valida antes de
  // pagar (solo para mostrar el total con descuento) — el monto real
  // siempre se vuelve a calcular en el servidor al cobrar y al confirmar.
  const [couponInput, setCouponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; amount: number; description: string | null } | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [checkingCoupon, setCheckingCoupon] = useState(false)

  async function applyCoupon() {
    if (!couponInput.trim()) return
    setCheckingCoupon(true)
    setCouponError(null)
    const result = await validateDiscountCodeAction(propertyId, checkin, checkout, guests, couponInput)
    setCheckingCoupon(false)
    if ('error' in result) {
      setCouponError(result.error ?? 'Ese código no es válido.')
      setAppliedCoupon(null)
      return
    }
    setAppliedCoupon({ code: result.code!, amount: result.discountAmount!, description: result.description ?? null })
  }

  function removeCoupon() {
    setAppliedCoupon(null)
    setCouponInput('')
    setCouponError(null)
  }

  const addonSelections = useMemo(
    () =>
      Object.entries(addonQuantities)
        .filter(([, qty]) => qty > 0)
        .map(([addonId, quantity]) => ({ addonId, quantity })),
    [addonQuantities]
  )

  const addonsTotal = useMemo(
    () =>
      addons.reduce((sum, a) => {
        const qty = addonQuantities[a.id] ?? 0
        return sum + a.price_mxn * qty
      }, 0),
    [addons, addonQuantities]
  )

  const total = Math.max(0, baseTotal + addonsTotal - (appliedCoupon?.amount ?? 0))

  function setAddonQty(addon: AddonOption, qty: number) {
    setAddonQuantities((prev) => ({
      ...prev,
      [addon.id]: Math.max(0, Math.min(qty, addon.unit === 'per_unit' ? addon.max_quantity : 1)),
    }))
  }
  // Nota: ya no se guarda un estado local "bookingId" para mostrar la
  // confirmación aquí mismo. En cuanto la reserva se crea, se navega a
  // /reserva-confirmada — ver el comentario en ese archivo para el porqué
  // (si se queda en esta misma página, el refresco automático que dispara
  // el servidor al confirmar hace que esta pantalla "salte" de vuelta a un
  // falso mensaje de "fechas no disponibles").
  const [finalizing, setFinalizing] = useState(false)

  const infoComplete = guestInfo.name.trim().length > 1 && /\S+@\S+\.\S+/.test(guestInfo.email) && guestInfo.phone.trim().length >= 8

  async function chooseProvider(next: Provider) {
    trackMetaEvent('AddPaymentInfo', { value: total, currency: 'MXN', content_ids: [propertyId] })
    setError(null)
    setProvider(next)
    if (next === 'stripe' && !clientSecret) {
      setLoadingProvider('stripe')
      const result = await createStripePaymentIntent({ propertyId, checkin, checkout, guests, guestInfo, addonSelections, discountCode: appliedCoupon?.code })
      setLoadingProvider(null)
      if ('error' in result) {
        setError(result.error ?? 'Ocurrió un error inesperado.')
        setProvider(null)
        return
      }
      setClientSecret(result.clientSecret ?? null)
    }
  }

  async function handleStripeConfirmed(paymentIntentId: string) {
    setFinalizing(true)
    setError(null)
    const result = await finalizeStripeBooking(paymentIntentId, { propertyId, checkin, checkout, guests, guestInfo, addonSelections, discountCode: appliedCoupon?.code })
    if ('error' in result) {
      setFinalizing(false)
      setError(result.error ?? 'Ocurrió un error inesperado.')
      return
    }
    // No usar setFinalizing(false) aquí: nos vamos de esta página, así que
    // no hace falta (y evita un parpadeo del botón justo antes de navegar).
    router.push(`/reserva-confirmada?bookingId=${result.bookingId}`)
  }

  async function handleMercadoPagoToken(data: {
    token: string
    issuer_id: string
    payment_method_id: string
    installments: number
  }) {
    setFinalizing(true)
    setError(null)
    const result = await createMercadoPagoPayment({
      propertyId,
      checkin,
      checkout,
      guests,
      guestInfo,
      addonSelections,
      discountCode: appliedCoupon?.code,
      token: data.token,
      paymentMethodId: data.payment_method_id,
      issuerId: data.issuer_id,
      installments: data.installments,
    })
    if ('error' in result) {
      setFinalizing(false)
      setError(result.error ?? 'Ocurrió un error inesperado.')
      return
    }
    router.push(`/reserva-confirmada?bookingId=${result.bookingId}`)
  }

  return (
    <div className="mt-5 pt-5 border-t border-stone/10 space-y-5">
      {addons.length > 0 && !confirmed && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-navy-deep">Extras opcionales</p>
          <div className="space-y-2">
            {addons.map((addon) => {
              const qty = addonQuantities[addon.id] ?? 0
              return (
                <div
                  key={addon.id}
                  className="flex items-center gap-3 rounded-xl border border-stone/20 p-3"
                >
                  {addon.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={addon.photo_url} alt="" className="h-12 w-12 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-cream shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-navy-deep truncate">{addon.name}</p>
                    {addon.description && (
                      <p className="text-xs text-stone">{addon.description}</p>
                    )}
                    <p className="text-xs text-stone mt-0.5">
                      ${addon.price_mxn.toLocaleString('es-MX')} MXN{addon.unit === 'per_unit' ? ' c/u' : ''}
                    </p>
                  </div>
                  {addon.unit === 'flat' ? (
                    <button
                      type="button"
                      onClick={() => setAddonQty(addon, qty > 0 ? 0 : 1)}
                      className={
                        qty > 0
                          ? 'rounded-full bg-navy px-3 py-1.5 text-xs font-medium text-cream shrink-0'
                          : 'rounded-full border border-stone/25 px-3 py-1.5 text-xs font-medium text-navy-deep shrink-0'
                      }
                    >
                      {qty > 0 ? 'Agregado ✓' : 'Agregar'}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setAddonQty(addon, qty - 1)}
                        disabled={qty === 0}
                        className="h-7 w-7 rounded-full border border-stone/25 text-navy-deep disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-4 text-center text-sm text-navy-deep">{qty}</span>
                      <button
                        type="button"
                        onClick={() => setAddonQty(addon, qty + 1)}
                        disabled={qty >= addon.max_quantity}
                        className="h-7 w-7 rounded-full border border-stone/25 text-navy-deep disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!confirmed && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-navy-deep">¿Tienes un código de descuento?</p>
          {appliedCoupon ? (
            <div className="flex items-center justify-between rounded-xl border border-gold/40 bg-gold/10 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-navy-deep">
                  {appliedCoupon.code} aplicado — -${Math.round(appliedCoupon.amount).toLocaleString('es-MX')} MXN
                </p>
                {appliedCoupon.description && <p className="text-xs text-stone">{appliedCoupon.description}</p>}
              </div>
              <button type="button" onClick={removeCoupon} className="text-xs text-stone hover:text-burnt-orange transition shrink-0 ml-2">
                Quitar
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Código de descuento"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                className="flex-1 rounded-xl border border-stone/25 px-3 py-2.5 text-sm text-navy-deep focus:outline-none focus:ring-2 focus:ring-gold/50"
              />
              <button
                type="button"
                onClick={applyCoupon}
                disabled={checkingCoupon || !couponInput.trim()}
                className="rounded-xl border border-stone/25 px-4 py-2.5 text-sm font-medium text-navy-deep hover:border-gold transition disabled:opacity-40"
              >
                {checkingCoupon ? 'Validando…' : 'Aplicar'}
              </button>
            </div>
          )}
          {couponError && <p className="text-xs text-burnt-orange">{couponError}</p>}
        </div>
      )}

      <div className="flex justify-between items-baseline pt-2">
        <span className="text-sm text-stone">Total a pagar</span>
        <span className="font-display text-2xl text-navy-deep">
          ${Math.round(total).toLocaleString('es-MX')} MXN
        </span>
      </div>

      {!confirmed ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-navy-deep">Tus datos</p>
          <input
            type="text"
            placeholder="Nombre completo"
            value={guestInfo.name}
            onChange={(e) => setGuestInfo({ ...guestInfo, name: e.target.value })}
            className="w-full rounded-xl border border-stone/25 px-3 py-2.5 text-sm text-navy-deep focus:outline-none focus:ring-2 focus:ring-gold/50"
          />
          <input
            type="email"
            placeholder="Correo electrónico"
            value={guestInfo.email}
            onChange={(e) => setGuestInfo({ ...guestInfo, email: e.target.value })}
            className="w-full rounded-xl border border-stone/25 px-3 py-2.5 text-sm text-navy-deep focus:outline-none focus:ring-2 focus:ring-gold/50"
          />
          <input
            type="tel"
            placeholder="Teléfono / WhatsApp"
            value={guestInfo.phone}
            onChange={(e) => setGuestInfo({ ...guestInfo, phone: e.target.value })}
            className="w-full rounded-xl border border-stone/25 px-3 py-2.5 text-sm text-navy-deep focus:outline-none focus:ring-2 focus:ring-gold/50"
          />
          <textarea
            placeholder="Notas para tu anfitrión (opcional)"
            value={guestInfo.notes}
            onChange={(e) => setGuestInfo({ ...guestInfo, notes: e.target.value })}
            rows={2}
            className="w-full rounded-xl border border-stone/25 px-3 py-2.5 text-sm text-navy-deep focus:outline-none focus:ring-2 focus:ring-gold/50"
          />
          <button
            onClick={() => {
              trackMetaEvent('InitiateCheckout', { value: total, currency: 'MXN', content_ids: [propertyId] })
              setConfirmed(true)
            }}
            disabled={!infoComplete}
            className="w-full rounded-full bg-navy px-4 py-2.5 text-sm font-medium text-cream hover:bg-navy-deep transition disabled:opacity-40"
          >
            Continuar al pago
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <button onClick={() => setConfirmed(false)} className="text-xs text-stone hover:text-navy-deep transition">
            ← Editar mis datos
          </button>

          {!provider && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => chooseProvider('stripe')}
                disabled={loadingProvider !== null}
                className="rounded-2xl border border-stone/20 px-4 py-4 text-sm font-medium text-navy-deep hover:border-gold hover:bg-gold/5 transition disabled:opacity-50"
              >
                {loadingProvider === 'stripe' ? 'Cargando…' : 'Pagar con tarjeta (Stripe)'}
              </button>
              <button
                onClick={() => chooseProvider('mercadopago')}
                disabled={loadingProvider !== null}
                className="rounded-2xl border border-stone/20 px-4 py-4 text-sm font-medium text-navy-deep hover:border-gold hover:bg-gold/5 transition disabled:opacity-50"
              >
                Mercado Pago
              </button>
            </div>
          )}

          {provider === 'stripe' && clientSecret && (
            <div>
              <button onClick={() => { setProvider(null); }} className="text-xs text-stone hover:text-navy-deep transition mb-3 inline-block">
                ← Elegir otro método
              </button>
              <StripePaymentForm
                publishableKey={stripePublishableKey}
                clientSecret={clientSecret}
                onConfirmed={handleStripeConfirmed}
                onError={setError}
              />
            </div>
          )}

          {provider === 'mercadopago' && (
            <div>
              <button onClick={() => setProvider(null)} className="text-xs text-stone hover:text-navy-deep transition mb-3 inline-block">
                ← Elegir otro método
              </button>
              <MercadoPagoPaymentForm
                publicKey={mercadoPagoPublicKey}
                total={total}
                guestEmail={guestInfo.email}
                onSubmitToken={handleMercadoPagoToken}
                onError={setError}
              />
              {/* Mismo patrón que Stripe: el aviso completo (incluye guardar
                  la tarjeta para cargos futuros por extras/daños) vive en
                  /politicas — aquí solo el link. */}
              <p className="text-xs text-stone mt-3">
                Al reservar, aceptas nuestras{' '}
                <Link href="/politicas" target="_blank" className="text-gold underline underline-offset-2">
                  políticas
                </Link>{' '}
                y el{' '}
                <Link href="/reglamento" target="_blank" className="text-gold underline underline-offset-2">
                  reglamento
                </Link>
                .
              </p>
            </div>
          )}

          {finalizing && <p className="text-sm text-stone text-center">Confirmando tu reserva…</p>}
        </div>
      )}

      {error && <p className="text-sm text-burnt-orange">{error}</p>}
    </div>
  )
}
