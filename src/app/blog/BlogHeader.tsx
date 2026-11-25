import Link from 'next/link'
import Image from 'next/image'

// Barra de arriba del blog (mismo estilo que la página de cada cabaña).
export default function BlogHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-stone/15 bg-[#f8f6f1]/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-5 py-2 md:px-10">
        <Link href="/" className="flex items-center gap-3" aria-label="Huasca Retreats">
          <Image src="/logo.png" alt="Huasca Retreats" width={800} height={750} className="h-12 w-auto md:h-14" />
          <span className="font-poster hidden text-lg sm:block">Huasca Retreats</span>
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-5 text-[15px] font-medium">
          <Link href="/blog" className="hidden hover:underline underline-offset-8 sm:inline">Blog</Link>
          <Link href="/#resultados" className="hidden hover:underline underline-offset-8 sm:inline">Cabañas</Link>
          <Link
            href="/#buscar"
            className="rounded-md border-[1.5px] border-navy-deep px-4 py-2 font-semibold transition hover:bg-navy-deep hover:text-cream"
          >
            Reservar
          </Link>
        </nav>
      </div>
    </header>
  )
}
