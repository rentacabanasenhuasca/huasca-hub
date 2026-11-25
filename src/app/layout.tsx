import type { Metadata } from "next";
import { Bowlby_One_SC, Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { getSitePhone } from "@/lib/home-catalog";
import WhatsAppFloatButton from "@/components/WhatsAppFloatButton";
import MetaPixel from "@/components/MetaPixel";
import SiteAnalytics from "@/components/SiteAnalytics";
import NavigationProgress from "@/components/NavigationProgress";
import { Suspense } from "react";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, CORE_KEYWORDS } from "@/lib/site";

// Tipografía más bold y contemporánea que las fuentes de sistema que se
// usaban antes (Georgia + sans del sistema). Fraunces en su corte más
// grueso da los titulares editoriales-pero-modernos; Plus Jakarta Sans es
// una sans geométrica bold, muy usada en sitios de hospitalidad/boutique
// actuales. Se cargan como variables CSS y globals.css las conecta a
// .font-display / .font-body — no hay que subir ningún archivo de fuente.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "900"],
  style: ["normal", "italic"],
  display: "swap",
});

// Titulares del diseño nuevo de la portada (estilo póster, versalitas
// gruesas). Solo se usa donde aparece la clase .font-poster.
const bowlby = Bowlby_One_SC({
  subsets: ["latin"],
  variable: "--font-poster",
  weight: "400",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Cabañas y espacios de descanso en Huasca de Ocampo`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: CORE_KEYWORDS,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  generator: "Next.js",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Cabañas y espacios de descanso en Huasca de Ocampo`,
    description: SITE_DESCRIPTION,
    url: "/",
    images: [{ url: "/logo.png", width: 800, height: 750, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Cabañas en Huasca de Ocampo`,
    description: SITE_DESCRIPTION,
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  icons: { icon: "/logo.png", apple: "/logo.png" },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // El teléfono de WhatsApp del botón flotante viene del host en la base de
  // datos (hosts.phone, editable en /admin/configuracion) — nunca fijo en
  // el código. Hoy el sitio es de un solo host (Huasca Retreats), por eso
  // toma el primero; si esto se vende a otros hospedajes con su propio
  // dominio, aquí es donde habría que resolver "cuál host" según el
  // dominio de la petición en vez de tomar siempre el primero.
  const sitePhone = await getSitePhone();

  return (
    <html lang="es" className={`h-full antialiased ${fraunces.variable} ${plusJakarta.variable} ${bowlby.variable}`}>
      <body className="min-h-full flex flex-col">
        <MetaPixel />
        <SiteAnalytics />
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        {children}
        <WhatsAppFloatButton phone={sitePhone} />
      </body>
    </html>
  );
}
