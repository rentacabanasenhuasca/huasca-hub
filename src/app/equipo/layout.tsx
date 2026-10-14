import type { Metadata } from 'next'
import { requireStaff } from '@/lib/staff'
import { signOut } from '@/app/login/actions'

export const metadata: Metadata = {
  title: 'Panel de colaborador — Huasca Retreats',
  robots: { index: false, follow: false },
}

export default async function EquipoLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff()

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-navy-deep text-cream">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-gold-light text-[10px] tracking-[0.25em] uppercase">Huasca Retreats</p>
            <p className="text-sm font-medium">Panel de colaborador — {staff.name}</p>
          </div>
          <form action={signOut}>
            <button className="text-xs sm:text-sm text-stone hover:text-burnt-orange transition">Salir</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  )
}
