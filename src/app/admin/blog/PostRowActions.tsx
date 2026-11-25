'use client'

import { useTransition } from 'react'
import { setPostStatus, deletePost } from './actions'

export default function PostRowActions({ id, status, title }: { id: string; status: string; title: string }) {
  const [pending, start] = useTransition()
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => { await setPostStatus(id, status === 'published' ? 'draft' : 'published') })}
        className="rounded-full border border-stone/25 px-3 py-1.5 text-xs font-medium text-navy-deep hover:bg-cream disabled:opacity-50"
      >
        {status === 'published' ? 'Despublicar' : 'Publicar'}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (window.confirm(`¿Borrar "${title}"? No se puede deshacer.`)) start(async () => { await deletePost(id) })
        }}
        className="rounded-full border border-burnt-orange/40 px-3 py-1.5 text-xs font-medium text-burnt-orange hover:bg-burnt-orange/10 disabled:opacity-50"
      >
        Borrar
      </button>
    </div>
  )
}
