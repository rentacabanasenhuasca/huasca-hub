'use client'

// Botones para compartir un artículo del blog en redes. En celular, "Compartir"
// abre el menú del teléfono (Instagram, WhatsApp, Facebook, etc.); en
// computadora se usan los links directos de cada red y "Copiar link".
import { useState } from 'react'

export default function ShareButtons({
  url,
  title,
  caption,
  compact = false,
}: {
  url: string
  title: string
  caption?: string | null
  compact?: boolean
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const text = caption?.trim() || title
  const enc = encodeURIComponent

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      window.prompt('Copia el texto:', value)
    }
  }

  async function nativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url })
        return
      } catch {
        return
      }
    }
    copy(url, 'link')
  }

  const btn =
    'inline-flex items-center gap-2 rounded-full border border-[#d6cdbb] bg-white px-4 py-2 text-sm font-medium text-navy-deep transition hover:border-navy-deep'

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!compact && <span className="mr-1 text-sm text-[#6f6d5c]">Compartir:</span>}
      <button type="button" onClick={nativeShare} className={`${btn} sm:hidden`}>
        Compartir
      </button>
      <a
        className={btn}
        href={`https://wa.me/?text=${enc(`${text}\n\n${url}`)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        WhatsApp
      </a>
      <a
        className={btn}
        href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Facebook
      </a>
      <a
        className={btn}
        href={`https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(url)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        X
      </a>
      <button type="button" onClick={() => copy(url, 'link')} className={btn}>
        {copied === 'link' ? 'Link copiado' : 'Copiar link'}
      </button>
      {caption && (
        <button type="button" onClick={() => copy(`${caption.trim()}\n\n${url}`, 'texto')} className={btn}>
          {copied === 'texto' ? 'Texto copiado' : 'Copiar texto para Instagram'}
        </button>
      )}
    </div>
  )
}
