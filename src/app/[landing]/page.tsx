import { notFound } from 'next/navigation'
import LandingPage, { landingMetadata } from '@/components/LandingPage'
import { getLanding } from '@/lib/seo-landings'

// Páginas SEO por intención de búsqueda (/cabanas-con-jacuzzi-huasca-de-ocampo,
// /glamping-huasca-de-ocampo, ...). La lista vive en src/lib/seo-landings.ts;
// cualquier otra ruta que no sea una de esas da 404 como antes.
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ landing: string }> }) {
  const { landing } = await params
  return landingMetadata(landing)
}

export default async function Page({ params }: { params: Promise<{ landing: string }> }) {
  const { landing } = await params
  if (!getLanding(landing)) notFound()
  return <LandingPage slug={landing} />
}
