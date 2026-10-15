import Link from 'next/link'
import { LANDINGS } from '@/lib/seo-landings'

// Footer compartido entre las páginas públicas (inicio, cabaña). Los links
// legales van pequeños (12px, el tamaño típico en sitios de reservas — 8px
// sería casi ilegible y afecta accesibilidad) para no competir visualmente
// con el resto de la página.
export default function SiteFooter() {
  return (
    <footer className="border-t border-stone/10 mt-10">
      <div className="max-w-5xl mx-auto px-4 py-10 text-center">
        <p className="font-display text-lg text-navy-deep">Huasca Retreats</p>
        <p className="text-xs text-stone mt-1.5">Cabañas en Huasca de Ocampo, Hidalgo · México</p>
        <nav aria-label="Explora" className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-navy-deep">
          {LANDINGS.map((l) => (
            <Link key={l.slug} href={`/${l.slug}`} className="hover:text-gold transition">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-stone/70">
          <Link href="/politicas" className="hover:text-stone hover:underline underline-offset-2 transition">
            Políticas
          </Link>
          <span className="text-stone/30">·</span>
          <Link href="/reglamento" className="hover:text-stone hover:underline underline-offset-2 transition">
            Reglamento
          </Link>
          <span className="text-stone/30">·</span>
          <Link href="/extras" className="hover:text-stone hover:underline underline-offset-2 transition">
            Extras
          </Link>
        </div>
      </div>
    </footer>
  )
}
