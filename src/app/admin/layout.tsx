import Link from 'next/link'
import { requireHost } from '@/lib/hosts'
import { signOut } from '@/app/login/actions'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const host = await requireHost()

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-navy-deep text-cream">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-gold-light text-[10px] tracking-[0.25em] uppercase">
              Huasca Retreats
            </p>
            <p className="text-sm font-medium">Panel de anfitrión — {host.name}</p>
          </div>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-5 text-xs sm:text-sm">
            <Link href="/admin/propiedades" className="hover:text-gold-light transition">
              Propiedades
            </Link>
            <Link href="/admin/portada" className="hover:text-gold-light transition">
              Portada
            </Link>
            <Link href="/admin/reglas" className="hover:text-gold-light transition">
              Reglas de precio
            </Link>
            <Link href="/admin/calendario" className="hover:text-gold-light transition">
              Calendario
            </Link>
            <Link href="/admin/huespedes" className="hover:text-gold-light transition">
              Huéspedes
            </Link>
            <Link href="/admin/extras" className="hover:text-gold-light transition">
              Extras
            </Link>
            <Link href="/admin/cupones" className="hover:text-gold-light transition">
              Cupones
            </Link>
            <Link href="/admin/configuracion" className="hover:text-gold-light transition">
              Configuración
            </Link>
            <form action={signOut}>
              <button className="text-stone hover:text-burnt-orange transition">
                Salir
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  )
}
