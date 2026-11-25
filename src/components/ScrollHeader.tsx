'use client'

// Barra que aparece arriba al bajar de la foto principal: logo + buscador
// compacto, para que el buscador siga a la mano en toda la página (como la
// barra flotante del diseño anterior).
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

export default function ScrollHeader({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 0.75)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      className={`fixed inset-x-0 top-0 z-40 border-b border-stone/15 bg-[#f8f6f1]/95 backdrop-blur transition-transform duration-300 motion-reduce:transition-none ${
        show ? 'translate-y-0' : '-translate-y-full'
      }`}
      aria-hidden={!show}
      inert={!show}
    >
      <div className="mx-auto flex max-w-[1240px] items-center gap-4 px-4 py-2 sm:px-6">
        <Link href="/" aria-label="Huasca Retreats" className="shrink-0">
          <Image src="/logo.png" alt="" width={800} height={750} className="h-12 w-auto" />
        </Link>
        <div className="hidden min-w-0 flex-1 justify-end md:flex">{children}</div>
        <a
          href="#buscar"
          className="ml-auto rounded-md bg-gold px-4 py-2 text-sm font-semibold text-navy-deep md:hidden"
        >
          Buscar fechas
        </a>
      </div>
    </div>
  )
}
