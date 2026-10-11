'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { setCartAutoEmail, sendCartEmailAction, setCartStatus, importStripeCartsAction } from './actions'

export type CartView = {
  id: string
  propertyName: string
  dates: string
  guestsText: string
  total: string
  name: string
  phone: string
  email: string
  notes: string
  coupon: string | null
  stage: 'datos' | 'pago_iniciado' | 'pago_rechazado' | 'reservado'
  lastError: string | null
  status: 'abierto' | 'contactado' | 'recuperado' | 'descartado'
  updatedAt: string
  hostNotified: boolean
  guestEmailedAt: string | null
  datesFree: boolean
  datesPast: boolean
  whatsappLink: string | null
  whatsappMessage: string
  resumeUrl: string
  copyText: string
}

const STAGE: Record<CartView['stage'], { label: string; cls: string }> = {
  datos: { label: 'Llenó sus datos', cls: 'bg-stone/10 text-stone' },
  pago_iniciado: { label: 'Inició el pago', cls: 'bg-gold/20 text-navy-deep' },
  pago_rechazado: { label: 'Pago rechazado', cls: 'bg-burnt-orange/15 text-burnt-orange' },
  reservado: { label: 'Reservó', cls: 'bg-navy text-cream' },
}

const STATUS_LABELS: Record<CartView['status'], string> = {
  abierto: 'Sin contactar',
  contactado: 'Contactado',
  recuperado: 'Recuperado',
  descartado: 'Descartado',
}

function ago(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 48) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} días`
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          window.prompt('Copia manualmente:', text)
        }
      }}
      className="rounded-full border border-stone/25 px-3 py-1.5 text-xs font-medium text-navy-deep hover:border-gold transition"
    >
      {copied ? 'Copiado ✓' : label}
    </button>
  )
}

function CartCard({ cart }: { cart: CartView }) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const stage = STAGE[cart.stage]

  return (
    <div className="rounded-2xl border border-stone/15 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-navy-deep">{cart.name || 'Sin nombre'}</p>
          <p className="text-sm text-stone">
            {cart.propertyName} · {cart.dates} · {cart.guestsText}
          </p>
          <p className="text-sm text-navy-deep mt-0.5">
            {cart.total}
            {cart.coupon ? <span className="text-stone"> · cupón {cart.coupon}</span> : null}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${stage.cls}`}>{stage.label}</span>
          <span className="text-[11px] text-stone">{ago(cart.updatedAt)}</span>
        </div>
      </div>

      <div className="mt-2 text-sm text-stone space-y-0.5">
        <p>
          {cart.phone || 'Sin teléfono'} · {cart.email || 'sin correo'}
        </p>
        {cart.stage === 'pago_rechazado' && cart.lastError && <p className="text-burnt-orange">Motivo: {cart.lastError}</p>}
        {cart.notes && <p>Notas: {cart.notes}</p>}
        <p className={cart.datesPast ? 'text-stone' : cart.datesFree ? 'text-navy-deep' : 'text-burnt-orange'}>
          {cart.datesPast
            ? 'Las fechas ya pasaron'
            : cart.datesFree
              ? '✓ Las fechas siguen libres'
              : '✗ Esas fechas ya se ocuparon — ofrécele otras'}
        </p>
        {cart.guestEmailedAt && <p>Correo de recuperación enviado {ago(cart.guestEmailedAt)}</p>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {cart.phone && <CopyButton text={cart.phone} label="Copiar teléfono" />}
        <CopyButton text={cart.copyText} label="Copiar datos" />
        <CopyButton text={cart.whatsappMessage} label="Copiar mensaje" />
        {cart.whatsappLink && (
          <a
            href={cart.whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition"
          >
            WhatsApp
          </a>
        )}
        {cart.email && cart.stage !== 'reservado' && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await sendCartEmailAction(cart.id)
                setMessage(r.error ?? 'Correo enviado ✓')
              })
            }
            className="rounded-full border border-stone/25 px-3 py-1.5 text-xs font-medium text-navy-deep hover:border-gold transition disabled:opacity-40"
          >
            {cart.guestEmailedAt ? 'Reenviar correo' : 'Enviar correo'}
          </button>
        )}
        <CopyButton text={cart.resumeUrl} label="Copiar liga para retomar" />

        <select
          value={cart.status}
          disabled={pending}
          onChange={(e) =>
            startTransition(async () => {
              const r = await setCartStatus(cart.id, e.target.value as CartView['status'])
              if (r.error) setMessage(r.error)
            })
          }
          className="ml-auto rounded-full border border-stone/25 bg-white px-3 py-1.5 text-xs text-navy-deep"
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {message && <p className="mt-2 text-xs text-stone">{message}</p>}
    </div>
  )
}

export default function CartsManager({
  carts,
  autoEmail,
  showAll,
}: {
  carts: CartView[]
  autoEmail: boolean
  showAll: boolean
}) {
  const [auto, setAuto] = useState(autoEmail)
  const [pending, startTransition] = useTransition()
  const [importing, startImport] = useTransition()
  const [importMsg, setImportMsg] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-stone/15 bg-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-xl">
          <p className="text-sm font-medium text-navy-deep">Correo automático al huésped</p>
          <p className="text-xs text-stone mt-0.5">
            Si está encendido, a los 20 minutos sin reservar se le manda al huésped un correo con la liga para
            terminar su reserva (sus datos ya llenos). Apagado, solo se manda cuando tú le das &quot;Enviar correo&quot;.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={auto}
          disabled={pending}
          onClick={() => {
            const next = !auto
            setAuto(next)
            startTransition(async () => {
              const r = await setCartAutoEmail(next)
              if (r.error) setAuto(!next)
            })
          }}
          className={`relative h-7 w-12 rounded-full transition ${auto ? 'bg-gold' : 'bg-stone/30'} disabled:opacity-60`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${auto ? 'left-6' : 'left-1'}`}
          />
          <span className="sr-only">{auto ? 'Encendido' : 'Apagado'}</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link
          href="/admin/carritos"
          className={showAll ? 'text-stone hover:text-navy-deep' : 'font-medium text-navy-deep underline underline-offset-4'}
        >
          Pendientes
        </Link>
        <Link
          href="/admin/carritos?ver=todos"
          className={showAll ? 'font-medium text-navy-deep underline underline-offset-4' : 'text-stone hover:text-navy-deep'}
        >
          Todos (últimos 60 días)
        </Link>
        <button
          type="button"
          disabled={importing}
          onClick={() =>
            startImport(async () => {
              const r = await importStripeCartsAction()
              setImportMsg(r.error ?? `Listo: ${r.imported} pago(s) de Stripe agregados.`)
            })
          }
          className="ml-auto rounded-full border border-stone/25 bg-white px-3 py-1.5 text-xs font-medium text-navy-deep hover:border-gold transition disabled:opacity-40"
        >
          {importing ? 'Buscando en Stripe…' : 'Traer pagos incompletos de Stripe (10 días)'}
        </button>
      </div>
      {importMsg && <p className="text-xs text-stone">{importMsg}</p>}

      {carts.length === 0 ? (
        <p className="rounded-2xl border border-stone/15 bg-white p-6 text-sm text-stone text-center">
          No hay carritos {showAll ? '' : 'pendientes'} por ahora.
        </p>
      ) : (
        carts.map((cart) => <CartCard key={cart.id} cart={cart} />)
      )}
    </div>
  )
}
