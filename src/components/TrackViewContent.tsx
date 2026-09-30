'use client'

// Dispara el evento ViewContent del Meta Pixel una vez, cuando alguien
// entra a la página de una cabaña específica. Se monta desde
// /cabanas/[id]/page.tsx (server component) pasándole los datos ya
// resueltos — este componente no hace ninguna consulta, solo dispara.
import { useEffect } from 'react'
import { trackMetaEvent } from '@/lib/meta-pixel'

export default function TrackViewContent({
  id,
  name,
  price,
}: {
  id: string
  name: string
  price: number
}) {
  useEffect(() => {
    trackMetaEvent('ViewContent', {
      content_ids: [id],
      content_name: name,
      content_type: 'product',
      value: price,
      currency: 'MXN',
    })
    // Solo al montar / si cambia la cabaña vista — no en cada rerender por
    // cambio de fechas o huéspedes en la misma página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  return null
}
