'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { uuid } from '@/lib/uuid'
import { setHomepagePhoto, clearHomepagePhoto, type HomepageSlot } from './actions'

type SlotView = {
  slot: HomepageSlot
  label: string
  hint: string
  chosenUrl: string | null
  autoUrl: string | null
}

// Una tarjeta por cada foto de las secciones de la portada: muestra la foto
// que se ve hoy, permite subir otra y volver a la automática.
export default function HomepagePhotosManager({ slots }: { slots: SlotView[] }) {
  const [list, setList] = useState(slots)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function upload(slot: HomepageSlot, file: File) {
    setBusy(slot)
    setError(null)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `portada/${uuid()}${ext ? `.${ext}` : ''}`
      const { error: upErr } = await supabase.storage
        .from('site-media')
        .upload(path, file, { cacheControl: '3600', upsert: false })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('site-media').getPublicUrl(path)
      const res = await setHomepagePhoto(slot, data.publicUrl)
      if (res.error) setError(res.error)
      else setList((prev) => prev.map((s) => (s.slot === slot ? { ...s, chosenUrl: data.publicUrl } : s)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir la foto.')
    } finally {
      setBusy(null)
    }
  }

  function handleAuto(slot: HomepageSlot) {
    setError(null)
    setBusy(slot)
    startTransition(async () => {
      const res = await clearHomepagePhoto(slot)
      if (res.error) setError(res.error)
      else setList((prev) => prev.map((s) => (s.slot === slot ? { ...s, chosenUrl: null } : s)))
      setBusy(null)
    })
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-burnt-orange">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((s) => {
          const shown = s.chosenUrl ?? s.autoUrl
          return (
            <div key={s.slot} className="flex gap-3 rounded-xl border border-stone/15 bg-white p-3">
              <div className="h-24 w-32 shrink-0 overflow-hidden rounded-lg bg-cream">
                {shown ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shown} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-stone">Sin foto</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-navy-deep">{s.label}</p>
                <p className="text-xs text-stone">{s.hint}</p>
                <p className="mt-1 text-xs text-stone">
                  {s.chosenUrl ? 'Foto elegida por ti' : 'Automática (foto de una cabaña)'}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-navy-deep hover:bg-gold-light">
                    {busy === s.slot ? 'Subiendo…' : 'Cambiar foto'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={busy !== null}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) upload(s.slot, f)
                        e.target.value = ''
                      }}
                    />
                  </label>
                  {s.chosenUrl && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => handleAuto(s.slot)}
                      className="rounded-full border border-stone/25 px-3 py-1.5 text-xs font-medium text-navy-deep hover:bg-cream disabled:opacity-50"
                    >
                      Usar automática
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
