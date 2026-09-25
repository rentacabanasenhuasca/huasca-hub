'use client'

import { useRef, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { addHeroMedia, deleteHeroMedia, toggleHeroMedia, moveHeroMedia } from './actions'

type HeroMedia = {
  id: string
  media_type: 'image' | 'video'
  url: string
  sort_order: number
  enabled: boolean
}

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov']

function guessMediaType(fileName: string): 'image' | 'video' {
  const lower = fileName.toLowerCase()
  return VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext)) ? 'video' : 'image'
}

export default function HeroMediaManager({ items }: { items: HeroMedia[] }) {
  const [list, setList] = useState(items)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileSelected(file: File) {
    setUploading(true)
    setError(null)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `${crypto.randomUUID()}${ext ? `.${ext}` : ''}`

      const { error: uploadError } = await supabase.storage.from('site-media').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      })
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('site-media').getPublicUrl(path)
      const mediaType = file.type.startsWith('video/') ? 'video' : guessMediaType(file.name)

      const res = await addHeroMedia(mediaType, data.publicUrl)
      if (res.error || !res.item) {
        setError(res.error ?? 'No se pudo agregar el archivo.')
      } else {
        // Usamos el id real que regresó el servidor (no uno inventado aquí),
        // para que borrar/pausar/reordenar este elemento funcione de
        // inmediato sin necesidad de recargar la página primero.
        setList((prev) => [...prev, res.item as HeroMedia])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir el archivo.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleDelete(id: string) {
    setError(null)
    startTransition(async () => {
      const res = await deleteHeroMedia(id)
      if (res.error) {
        setError(res.error)
        return
      }
      setList((prev) => prev.filter((m) => m.id !== id))
    })
  }

  function handleToggle(id: string, enabled: boolean) {
    setError(null)
    setList((prev) => prev.map((m) => (m.id === id ? { ...m, enabled } : m)))
    startTransition(async () => {
      const res = await toggleHeroMedia(id, enabled)
      if (res.error) setError(res.error)
    })
  }

  function handleMove(id: string, direction: 'up' | 'down') {
    setError(null)
    const index = list.findIndex((m) => m.id === id)
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (index === -1 || swapIndex < 0 || swapIndex >= list.length) return
    setList((prev) => {
      const next = [...prev]
      ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
      return next
    })
    startTransition(async () => {
      const res = await moveHeroMedia(id, direction)
      if (res.error) setError(res.error)
    })
  }

  return (
    <div className="space-y-5">
      {error && <p className="text-sm text-burnt-orange">{error}</p>}

      <div className="rounded-xl border border-dashed border-stone/30 bg-white p-5">
        <label className="block text-sm font-medium text-navy-deep mb-2">Agregar foto o video</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/mp4,video/webm,video/quicktime"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileSelected(file)
          }}
          className="block w-full text-sm text-stone file:mr-3 file:rounded-full file:border-0 file:bg-gold file:px-4 file:py-2 file:text-xs file:font-semibold file:text-navy-deep hover:file:bg-gold-light file:cursor-pointer"
        />
        {uploading && <p className="text-xs text-stone mt-2">Subiendo…</p>}
        <p className="text-xs text-stone/70 mt-2">
          Recomendado: fotos horizontales de buena calidad (mínimo 1600px de ancho). Un video corto (10-20s) también
          funciona bien — se reproduce sin sonido y en bucle mientras es su turno en el carrusel.
        </p>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-stone">
          Todavía no agregas nada — la portada se ve con el fondo actual hasta que subas al menos una foto.
        </p>
      ) : (
        <div className="space-y-2">
          {list.map((m, i) => (
            <div key={m.id} className="flex items-center gap-3 rounded-xl border border-stone/15 bg-white p-3">
              <div className="h-16 w-24 shrink-0 rounded-lg overflow-hidden bg-cream">
                {m.media_type === 'video' ? (
                  <video src={m.url} className="h-full w-full object-cover" muted playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-navy-deep">
                  {m.media_type === 'video' ? 'Video' : 'Foto'} {i + 1}
                </p>
                <p className="text-xs text-stone truncate">{m.url}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={i === 0 || isPending}
                  onClick={() => handleMove(m.id, 'up')}
                  title="Subir"
                  className="h-7 w-7 rounded-full border border-stone/25 text-stone hover:text-navy-deep hover:border-navy-deep transition disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={i === list.length - 1 || isPending}
                  onClick={() => handleMove(m.id, 'down')}
                  title="Bajar"
                  className="h-7 w-7 rounded-full border border-stone/25 text-stone hover:text-navy-deep hover:border-navy-deep transition disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleToggle(m.id, !m.enabled)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    m.enabled ? 'bg-navy/10 text-navy-deep' : 'bg-stone/10 text-stone'
                  }`}
                >
                  {m.enabled ? 'Activo' : 'Pausado'}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDelete(m.id)}
                  className="text-xs text-burnt-orange hover:underline underline-offset-2"
                >
                  Borrar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
