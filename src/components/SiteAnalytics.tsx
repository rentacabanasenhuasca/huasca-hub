'use client'

// Medidores de visitas: Google Analytics 4 y Umami (este último corre en
// nuestro propio servidor de Hetzner, sin costo extra). Igual que el Meta
// Pixel, los IDs vienen de variables de Coolify y si alguna no está puesta
// ese medidor simplemente no se carga:
//   NEXT_PUBLIC_GA_ID              → ej. G-XXXXXXXXXX
//   NEXT_PUBLIC_UMAMI_SRC          → ej. https://umami.midominio.com/script.js
//   NEXT_PUBLIC_UMAMI_WEBSITE_ID   → el UUID del sitio en Umami
// Los dos ya registran solos los cambios de página dentro del sitio (sin
// recarga), así que no hace falta mandar nada a mano en cada navegación.
// No se cargan en el panel (/admin, /equipo) para no contar nuestras
// propias visitas.
import Script from 'next/script'
import { usePathname } from 'next/navigation'

const GA_ID = process.env.NEXT_PUBLIC_GA_ID
const UMAMI_SRC = process.env.NEXT_PUBLIC_UMAMI_SRC
const UMAMI_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID

export default function SiteAnalytics() {
  const pathname = usePathname() ?? ''
  if (pathname.startsWith('/admin') || pathname.startsWith('/equipo') || pathname.startsWith('/login')) return null

  return (
    <>
      {GA_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `}
          </Script>
        </>
      )}
      {UMAMI_SRC && UMAMI_ID && (
        <Script src={UMAMI_SRC} data-website-id={UMAMI_ID} strategy="afterInteractive" />
      )}
    </>
  )
}
