import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePartner } from '@/lib/partners'
import { signOut } from '@/app/login/actions'
import NewVersionBanner from '@/components/NewVersionBanner'
import { getBuildId } from '@/lib/build-id'

export const metadata: Metadata = {
  title: 'Panel de socio — Huasca Retreats',
  robots: { index: false, follow: false },
}

export default async function SociosLayout({ children }: { children: React.ReactNode }) {
  const partner = await requirePartner()

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-navy-deep text-cream">
        <div className="mx-auto max-w-4xl px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-gold-light text-[10px] tracking-[0.25em] uppercase">Huasca Retreats · Socios</p>
            <p className="text-sm font-medium">{partner.name}</p>
          </div>
          <nav className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
            <Link href="/socios" className="hover:text-gold-light">Mis cabañas</Link>
            <Link href="/socios/equipo" className="hover:text-gold-light">Mi equipo</Link>
            <Link href="/socios/datos" className="hover:text-gold-light">Datos de pago</Link>
            <Link href="/socios/terminos" className="hover:text-gold-light">Términos</Link>
            <form action={signOut}>
              <button className="text-stone hover:text-burnt-orange">Salir</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6 sm:py-8">{children}</main>
      <NewVersionBanner buildId={getBuildId()} />
    </div>
  )
}
