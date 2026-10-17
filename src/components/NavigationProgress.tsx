'use client'

// Barra dorada arriba de la pantalla que aparece en cuanto das clic a un
// link (en el sitio y en el admin) y se completa cuando la página nueva ya
// cargó. Next.js no muestra nada mientras el servidor arma la siguiente
// página, así que sin esto parecía que el clic no había hecho nada.
// Además: el cursor cambia a "cargando" y el link que tocaste se atenúa.
import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export default function NavigationProgress() {
  const barRef = useRef<HTMLDivElement>(null)
  const tick = useRef<ReturnType<typeof setInterval> | null>(null)
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null)
  const active = useRef(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const routeKey = `${pathname}?${searchParams.toString()}`

  useEffect(() => {
    const bar = barRef.current
    if (!bar) return

    function clearPending() {
      document.documentElement.classList.remove('nav-loading')
      document.querySelectorAll('[data-nav-pending]').forEach((el) => el.removeAttribute('data-nav-pending'))
    }

    function start(link?: Element | null) {
      if (!bar) return
      if (tick.current) clearInterval(tick.current)
      if (safety.current) clearTimeout(safety.current)
      active.current = true
      let progress = 10
      bar.style.transition = 'width 200ms ease-out, opacity 150ms'
      bar.style.opacity = '1'
      bar.style.width = `${progress}%`
      document.documentElement.classList.add('nav-loading')
      link?.setAttribute('data-nav-pending', '')
      tick.current = setInterval(() => {
        progress += (90 - progress) * 0.08
        bar.style.width = `${progress}%`
      }, 200)
      // Por si la navegación no llega a ocurrir (error de red, etc.).
      safety.current = setTimeout(() => {
        if (tick.current) clearInterval(tick.current)
        active.current = false
        bar.style.opacity = '0'
        bar.style.width = '0%'
        clearPending()
      }, 15000)
    }

    function onClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const link = (e.target as Element | null)?.closest?.('a')
      if (!link || !link.href) return
      if (link.target && link.target !== '_self') return
      if (link.hasAttribute('download')) return
      const url = new URL(link.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      start(link)
    }

    function onSubmit(e: SubmitEvent) {
      // Solo formularios de búsqueda normales (GET) que cambian de página;
      // los de acciones del servidor no navegan y tienen su propio "Guardando…".
      const form = e.target as HTMLFormElement | null
      if (!form || e.defaultPrevented) return
      const action = form.getAttribute('action') ?? ''
      if (action.startsWith('javascript:')) return
      if ((form.getAttribute('method') ?? 'get').toLowerCase() !== 'get') return
      if (!form.getAttribute('action')) return
      start(e.submitter ?? null)
    }

    document.addEventListener('click', onClick, true)
    document.addEventListener('submit', onSubmit)
    window.addEventListener('pageshow', clearPending)
    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('submit', onSubmit)
      window.removeEventListener('pageshow', clearPending)
    }
  }, [])

  // La ruta cambió: la página nueva ya está en pantalla → completar la barra.
  useEffect(() => {
    const bar = barRef.current
    if (!bar || !active.current) return
    active.current = false
    if (tick.current) clearInterval(tick.current)
    if (safety.current) clearTimeout(safety.current)
    document.documentElement.classList.remove('nav-loading')
    document.querySelectorAll('[data-nav-pending]').forEach((el) => el.removeAttribute('data-nav-pending'))
    bar.style.width = '100%'
    const hide = setTimeout(() => {
      bar.style.opacity = '0'
    }, 200)
    const reset = setTimeout(() => {
      bar.style.transition = 'none'
      bar.style.width = '0%'
    }, 450)
    return () => {
      clearTimeout(hide)
      clearTimeout(reset)
    }
  }, [routeKey])

  return (
    <div
      ref={barRef}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[9999] h-[3px] bg-gold shadow-[0_0_8px_rgba(201,162,39,0.7)]"
      style={{ width: '0%', opacity: 0 }}
    />
  )
}
