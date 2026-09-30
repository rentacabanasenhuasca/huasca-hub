'use client'

// Carga el Meta Pixel base (script + init + primer PageView) una sola vez,
// montado en el layout raíz. En Next.js App Router las navegaciones entre
// páginas son SPA (no recargan el documento), así que el snippet base solo
// ve el PageView inicial — este componente reenvía PageView a mano en cada
// cambio de ruta después de esa primera carga.
//
// El ID viene de NEXT_PUBLIC_META_PIXEL_ID (Coolify) — si no está
// configurado, el componente no renderiza nada (no rompe el sitio en
// entornos donde aún no se haya puesto la variable, ej. Preview).
import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID

export default function MetaPixel() {
  const pathname = usePathname()
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (!PIXEL_ID || typeof window.fbq !== 'function') return
    if (isFirstRender.current) {
      // El snippet base (abajo) ya dispara el PageView de esta primera
      // carga — evitamos duplicarlo.
      isFirstRender.current = false
      return
    }
    window.fbq('track', 'PageView')
  }, [pathname])

  if (!PIXEL_ID) return null

  return (
    <>
      <Script id="meta-pixel-base" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${PIXEL_ID}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  )
}
