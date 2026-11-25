import Link from 'next/link'
import Image from 'next/image'
import { LANDINGS } from '@/lib/seo-landings'

// Footer compartido de las páginas públicas (diseño 2026): franja verde
// bosque con logo y tres columnas de links.
export default function SiteFooter({ className = 'mt-16' }: { className?: string }) {
  const link = 'opacity-80 hover:opacity-100 hover:underline underline-offset-2'
  return (
    <footer className={`${className} bg-navy-deep pb-10 pt-20 text-[#e9e1d2]`}>
      <div className="mx-auto max-w-[1240px] px-5 md:px-10">
        <div className="grid grid-cols-2 gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" aria-label="Huasca Retreats">
              <Image src="/logo.png" alt="Huasca Retreats" width={800} height={750} className="h-24 w-auto" />
            </Link>
            <p className="mt-5 max-w-[20em] text-[15px] opacity-75">
              Cabañas en el bosque de Huasca de Ocampo, Hidalgo. Reserva directo con nosotros.
            </p>
          </div>
          <div>
            <h4 className="font-poster mb-5 text-xl text-gold">Hospédate</h4>
            <ul className="grid gap-2.5 text-[15px]">
              <li><Link href="/#resultados" className={link}>Todas las cabañas</Link></li>
              <li><Link href="/#calendario-disponibilidad" className={link}>Disponibilidad</Link></li>
              <li><Link href="/extras" className={link}>Extras</Link></li>
              <li><Link href="/en-venta" className={link}>Casas en venta</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-poster mb-5 text-xl text-gold">Conoce</h4>
            <ul className="grid gap-2.5 text-[15px]">
              {LANDINGS.map((l) => (
                <li key={l.slug}><Link href={`/${l.slug}`} className={link}>{l.label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-poster mb-5 text-xl text-gold">Información</h4>
            <ul className="grid gap-2.5 text-[15px]">
              <li><Link href="/politicas" className={link}>Políticas</Link></li>
              <li><Link href="/reglamento" className={link}>Reglamento</Link></li>
              <li><Link href="/socios/registro" className={link}>Anuncia tu cabaña</Link></li>
              <li><Link href="/admin" className={link}>Panel de anfitrión</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-16 flex flex-col justify-between gap-2 border-t border-[#e9e1d2]/15 pt-6 text-[13px] opacity-60 sm:flex-row">
          <span>© {new Date().getFullYear()} Huasca Retreats</span>
          <span>Huasca de Ocampo, Hidalgo, México</span>
        </div>
      </div>
    </footer>
  )
}
