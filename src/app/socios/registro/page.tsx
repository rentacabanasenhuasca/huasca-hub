import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { currentPartnerOrNull, registerPartner } from '../actions'
import RegistroForm from './RegistroForm'
import { PARTNER_FEE_PCT } from '@/lib/partners'

export const metadata: Metadata = {
  title: 'Publica tu cabaña en Huasca Retreats',
  description: 'Registro para socios: publica tu cabaña en huascaretreats.com y recibe reservas.',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

export default async function RegistroPage() {
  if (await currentPartnerOrNull()) redirect('/socios')
  return (
    <div className="min-h-screen bg-cream">
      <main className="mx-auto max-w-xl px-4 py-10 space-y-5">
        <div>
          <p className="text-gold text-[11px] tracking-[0.25em] uppercase">Huasca Retreats · Socios</p>
          <h1 className="mt-1 text-2xl font-semibold text-navy-deep">Publica tu cabaña con nosotros</h1>
          <p className="mt-2 text-sm text-stone">
            Recibe reservas de huéspedes de Huasca Retreats. Publicar no cuesta: tú pones tu precio y solo se te descuenta un {PARTNER_FEE_PCT}% de
            comisión cuando hay reserva. Huasca Retreats agrega su cargo de plataforma al precio del huésped. Te pagamos al día siguiente del check-in.
          </p>
        </div>
        <ol className="rounded-2xl border border-stone/15 bg-white p-5 text-sm text-navy-deep space-y-1.5 list-decimal list-inside">
          <li>Crea tu cuenta (este formulario).</li>
          <li>Registra tu cabaña: fotos, descripción, servicios, ubicación, precio y mínimo de noches.</li>
          <li>Registra tu cuenta bancaria (CLABE) con tu comprobante.</li>
          <li>Conecta tu calendario de Airbnb / Booking o bloquea tus fechas ocupadas.</li>
          <li>Revisamos tu cabaña y la publicamos. ¡Listo para recibir reservas!</li>
        </ol>
        <RegistroForm action={registerPartner} />
        <p className="text-center text-xs text-stone">
          ¿Ya tienes cuenta? <Link href="/login?next=/socios" className="text-navy-deep underline underline-offset-2">Entra aquí</Link>
        </p>
      </main>
    </div>
  )
}
