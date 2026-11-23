import type { Metadata } from 'next'
import Link from 'next/link'
import TermsContent from './TermsContent'

export const metadata: Metadata = { title: 'Términos para socios — Huasca Retreats', robots: { index: false, follow: false } }

export default function TerminosSociosPage() {
  return (
    <div className="min-h-screen bg-cream">
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/socios" className="text-xs text-stone hover:text-navy-deep">← Volver</Link>
        <h1 className="mt-2 text-2xl font-semibold text-navy-deep">Términos para socios</h1>
        <p className="text-sm text-stone mt-1">Huasca Retreats · publicación de cabañas de terceros en huascaretreats.com</p>
        <div className="mt-4 rounded-2xl border border-stone/15 bg-white p-5 sm:p-6">
          <TermsContent />
        </div>
      </main>
    </div>
  )
}
