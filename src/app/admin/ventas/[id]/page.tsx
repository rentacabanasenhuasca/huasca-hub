import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { requireHost } from '@/lib/hosts'
import ConfirmSubmitButton from '@/components/ConfirmSubmitButton'
import SaleListingForm from '../SaleListingForm'
import { updateSaleListing, deleteSaleListing } from '../actions'
import type { SaleListing, SaleMedia } from '@/lib/sale-listings'

export default async function EditarVentaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ guardado?: string }>
}) {
  const { id } = await params
  const { guardado } = await searchParams
  const host = await requireHost()
  const supabase = await createClient()

  const { data: listing } = await supabase.from('sale_listings').select('*').eq('id', id).eq('host_id', host.id).maybeSingle()
  if (!listing) notFound()

  const [{ data: media }, { data: properties }] = await Promise.all([
    supabase.from('sale_listing_media').select('id, kind, url, caption, sort_order').eq('listing_id', id).order('sort_order'),
    supabase.from('properties').select('id, name').eq('host_id', host.id).is('archived_at', null).order('name'),
  ])

  const hdrs = await headers()
  const requestHost = hdrs.get('host') ?? 'huascaretreats.com'
  const publicUrl = `https://${requestHost}/en-venta/${listing.slug}`

  const boundUpdate = updateSaleListing.bind(null, id)
  const boundDelete = deleteSaleListing.bind(null, id)

  return (
    <div>
      {guardado && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Cambios guardados.</p>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-navy-deep">{listing.title}</h1>
          <p className="mt-1 text-sm text-stone">
            Link directo:{' '}
            {listing.status === 'draft' ? (
              <span>{publicUrl} (se activa al publicarla)</span>
            ) : (
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-gold underline underline-offset-2 break-all">
                {publicUrl}
              </a>
            )}
          </p>
        </div>
        <form action={boundDelete}>
          <ConfirmSubmitButton
            confirmMessage={`¿Eliminar "${listing.title}"? Su página dejará de existir. No se puede deshacer.`}
            className="text-sm text-burnt-orange hover:underline"
          >
            Eliminar
          </ConfirmSubmitButton>
        </form>
      </div>
      <SaleListingForm
        action={boundUpdate}
        listing={listing as SaleListing}
        media={(media ?? []) as SaleMedia[]}
        properties={properties ?? []}
        submitLabel="Guardar cambios"
      />
    </div>
  )
}
