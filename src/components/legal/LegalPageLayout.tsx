import Link from 'next/link'
import Image from 'next/image'

// Piezas compartidas entre las páginas legales del sitio (políticas,
// reglamento, y cualquier otra que se agregue después) — mismo header,
// misma tipografía de secciones, mismas listas. Así todas se ven como parte
// del mismo sitio en vez de páginas sueltas.

export function LegalPageShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="font-body min-h-full bg-cream">
      <div className="sticky top-4 z-30 px-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between rounded-[28px] border border-stone/10 bg-white/90 backdrop-blur-md pl-5 pr-2.5 py-2 shadow-[0_1px_3px_rgba(16,27,40,0.08)]">
          <Link href="/" className="text-xs text-stone hover:text-navy-deep transition">
            ← Volver
          </Link>
          <Link href="/" aria-label="Huasca Retreats" className="shrink-0">
            <Image src="/logo.png" alt="Huasca Retreats" width={800} height={750} className="h-16 w-auto drop-shadow-md" />
          </Link>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 pt-8 pb-16 sm:pt-10">
        <h1 className="font-display text-3xl sm:text-4xl text-navy-deep">{title}</h1>
        <p className="text-sm text-stone mt-2">{subtitle}</p>

        {children}
      </main>
    </div>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 pt-10 border-t border-stone/10 first:mt-0 first:pt-0 first:border-0">
      <h2 className="font-display text-xl sm:text-2xl text-navy-deep mb-4">{title}</h2>
      <div className="space-y-4 text-[15px] text-stone leading-relaxed">{children}</div>
    </section>
  )
}

export function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="font-display text-base text-navy-deep pt-2">{children}</h3>
}

export function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="h-1.5 w-1.5 rounded-full bg-gold shrink-0 mt-2" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-burnt-orange/25 bg-burnt-orange/5 px-4 py-3 text-sm text-navy-deep font-medium">
      {children}
    </div>
  )
}
