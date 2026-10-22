import Link from 'next/link'
import Image from 'next/image'
import { SITE_NAME } from '@/lib/site'

// Barra superior de las páginas de casas en venta (mismo estilo que el sitio).
export default function SaleHeader({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <div className="sticky top-4 z-30 px-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 rounded-[28px] border border-stone/10 bg-white/90 backdrop-blur-md px-5 py-2 shadow-[0_1px_3px_rgba(16,27,40,0.08)]">
        <Link href={backHref} className="text-xs text-stone hover:text-navy-deep transition">
          ← {backLabel}
        </Link>
        <Link href="/" aria-label={SITE_NAME}>
          <Image src="/logo.png" alt={SITE_NAME} width={800} height={750} className="h-16 w-auto sm:h-20" />
        </Link>
      </div>
    </div>
  )
}
