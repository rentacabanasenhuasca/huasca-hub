'use client'

// Botón flotante de WhatsApp, visible en todo el sitio público (no en
// /admin ni /login). El número NUNCA está fijo en el código — se lee del
// host en la base de datos (hosts.phone), configurable desde
// /admin/configuracion. Así, si Christian vende esta misma plataforma a
// otro hospedaje, cada quien pone su propio número ahí sin tocar código.
import { usePathname } from 'next/navigation'
import { trackMetaEvent } from '@/lib/meta-pixel'

function digitsOnly(phone: string) {
  return phone.replace(/[^\d]/g, '')
}

export default function WhatsAppFloatButton({ phone }: { phone: string | null }) {
  const pathname = usePathname()

  const isPublicPage = !pathname.startsWith('/admin') && !pathname.startsWith('/login')
  if (!isPublicPage || !phone) return null

  const digits = digitsOnly(phone)
  if (!digits) return null

  const href = `https://wa.me/${digits}?text=${encodeURIComponent('Hola, tengo una pregunta sobre una reserva.')}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      onClick={() => trackMetaEvent('Contact')}
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-lg shadow-black/20 transition hover:scale-105 hover:brightness-105 sm:h-16 sm:w-16"
    >
      <svg viewBox="0 0 32 32" className="h-8 w-8 sm:h-9 sm:w-9" fill="#ffffff" aria-hidden="true">
        <path d="M16.004 3C9.376 3 4 8.373 4 15c0 2.31.646 4.47 1.766 6.31L4 29l7.86-1.73A11.94 11.94 0 0 0 16.004 27C22.63 27 28 21.627 28 15S22.63 3 16.004 3Zm0 21.6c-2 0-3.87-.55-5.47-1.5l-.39-.23-4.66 1.03 1.05-4.53-.25-.4A9.57 9.57 0 0 1 5.4 15c0-5.85 4.76-10.6 10.604-10.6S26.6 9.15 26.6 15 21.85 24.6 16.004 24.6Zm5.83-7.94c-.32-.16-1.9-.94-2.2-1.04-.29-.11-.5-.16-.72.16-.21.32-.82 1.04-1 1.25-.19.21-.37.24-.69.08-.32-.16-1.34-.5-2.55-1.58-.94-.84-1.58-1.87-1.76-2.19-.19-.32-.02-.49.14-.65.14-.14.32-.37.48-.55.16-.19.21-.32.32-.53.11-.21.05-.4-.03-.56-.08-.16-.72-1.75-.99-2.39-.26-.63-.53-.55-.72-.56h-.62c-.21 0-.56.08-.85.4-.29.32-1.12 1.1-1.12 2.68s1.15 3.11 1.31 3.33c.16.21 2.26 3.47 5.48 4.86.77.33 1.36.53 1.83.68.77.24 1.47.21 2.02.13.62-.09 1.9-.78 2.17-1.53.27-.75.27-1.4.19-1.53-.08-.13-.29-.21-.61-.37Z" />
      </svg>
    </a>
  )
}
