import type { Metadata } from 'next'
import Link from 'next/link'
import { requireStaff } from '@/lib/staff'
import { signOut } from '@/app/login/actions'
import NewVersionBanner from '@/components/NewVersionBanner'
import { getBuildId } from '@/lib/build-id'

export const metadata: Metadata = {
  title: 'Panel de colaborador — Huasca Retreats',
  robots: { index: false, follow: false },
}

export default async function EquipoLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff()
  // Solo quien recibió el acceso del anfitrión puede, a su vez, dar acceso.
  const canManageTeam = staff.can_manage_team && !staff.created_by_staff_id && !staff.created_by_partner_id

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-navy-deep text-cream">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-gold-light text-[10px] tracking-[0.25em] uppercase">Huasca Retreats</p>
            <p className="text-sm font-medium">Panel de colaborador — {staff.name}</p>
          </div>
          <nav className="flex items-center gap-4 text-xs sm:text-sm">
            <Link href="/equipo" className="hover:text-gold-light">Calendario</Link>
            {canManageTeam && (
              <Link href="/equipo/mi-equipo" className="hover:text-gold-light">Mi equipo</Link>
            )}
            <form action={signOut}>
              <button className="text-stone hover:text-burnt-orange transition">Salir</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>
      <NewVersionBanner buildId={getBuildId()} />
    </div>
  )
}
