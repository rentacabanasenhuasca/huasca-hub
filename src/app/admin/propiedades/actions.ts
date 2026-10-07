'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireHost } from '@/lib/hosts'
import { generateUniqueSlug } from '@/lib/slug'
import { removeUnreferencedFiles } from '@/lib/storage-cleanup'

type ActionState = { error: string | null }

const DAY_KEYS = ['0', '1', '2', '3', '4', '5', '6']

function parseDays(formData: FormData, field: string) {
  const selected = DAY_KEYS.filter((d) => formData.get(`${field}_${d}`) === 'on').map(Number)
  return selected.length > 0 ? selected : [0, 1, 2, 3, 4, 5, 6]
}

function num(formData: FormData, field: string): number | null {
  const raw = formData.get(field)
  if (raw === null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function parseMinNightsByDay(formData: FormData): Record<string, number> {
  const result: Record<string, number> = {}
  for (const d of DAY_KEYS) {
    const n = num(formData, `min_nights_day_${d}`)
    if (n !== null && n >= 1) result[d] = n
  }
  return result
}

function buildPropertyPayload(formData: FormData) {
  return {
    name: String(formData.get('name') || '').trim(),
    description: String(formData.get('description') || '').trim() || null,

    capacity: num(formData, 'capacity') ?? 1,
    bedrooms: num(formData, 'bedrooms') ?? 1,
    beds: num(formData, 'beds') ?? 1,
    bathrooms: num(formData, 'bathrooms') ?? 1,

    infants_count_toward_capacity: formData.get('infants_count_toward_capacity') === 'on',
    max_infants: num(formData, 'max_infants'),
    max_children: num(formData, 'max_children'),

    weekday_price_mxn: num(formData, 'weekday_price_mxn') ?? 0,
    weekend_price_mxn: num(formData, 'weekend_price_mxn') ?? 0,
    price_tier: (String(formData.get('price_tier') || '') || null) as
      | 'accesible'
      | 'media'
      | 'lujo'
      | null,
    base_occupancy: num(formData, 'base_occupancy') ?? num(formData, 'capacity') ?? 1,
    extra_guest_fee_mxn: num(formData, 'extra_guest_fee_mxn') ?? 0,

    google_maps_link: String(formData.get('google_maps_link') || '').trim() || null,
    lat: num(formData, 'lat'),
    lng: num(formData, 'lng'),
    show_exact_location: formData.get('show_exact_location') === 'on',

    pet_friendly: formData.get('pet_friendly') === 'on',
    status: (formData.get('status') === 'published' ? 'published' : 'draft') as
      | 'draft'
      | 'published',

    min_nights: num(formData, 'min_nights') ?? 1,
    min_nights_by_day: parseMinNightsByDay(formData),
    max_nights: num(formData, 'max_nights'),
    min_advance_days: num(formData, 'min_advance_days') ?? 0,
    booking_window_days: num(formData, 'booking_window_days') ?? 365,
    allowed_arrival_days: parseDays(formData, 'arrival'),
    allowed_departure_days: parseDays(formData, 'departure'),
    cancellation_policy: (String(formData.get('cancellation_policy') || 'moderada') ||
      'moderada') as 'flexible' | 'moderada' | 'estricta',
  }
}

async function syncAmenities(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  formData: FormData
) {
  const amenityIds = formData.getAll('amenity_ids').map(String)

  await supabase.from('property_amenities').delete().eq('property_id', propertyId)

  if (amenityIds.length > 0) {
    const rows = amenityIds.map((amenityId) => ({
      property_id: propertyId,
      amenity_id: amenityId,
      description: String(formData.get(`amenity_note_${amenityId}`) || '').trim() || null,
    }))
    const { error } = await supabase.from('property_amenities').insert(rows)
    if (error) throw new Error(`No se pudieron guardar las amenidades: ${error.message}`)
  }
}

async function syncPhotos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  formData: FormData
) {
  const urls = formData.getAll('photo_url').map(String)
  const categories = formData.getAll('photo_category').map(String)
  const descriptions = formData.getAll('photo_description').map(String)

  const { data: previous } = await supabase.from('property_photos').select('url').eq('property_id', propertyId)
  await supabase.from('property_photos').delete().eq('property_id', propertyId)

  const rows = urls
    .map((url, i) => ({
      property_id: propertyId,
      url: url.trim(),
      category: categories[i]?.trim() || null,
      description: descriptions[i]?.trim() || null,
      sort_order: i,
    }))
    .filter((r) => r.url.length > 0)

  if (rows.length > 0) {
    const { error } = await supabase.from('property_photos').insert(rows)
    if (error) throw new Error(`No se pudieron guardar las fotos: ${error.message}`)
  }

  // Fotos que se quitaron en el formulario: borrar el archivo de Storage si
  // ya ninguna otra propiedad lo usa.
  const kept = new Set(rows.map((r) => r.url))
  await removeUnreferencedFiles((previous ?? []).map((r) => r.url).filter((u) => !kept.has(u)))
}

async function syncBeds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  propertyId: string,
  formData: FormData
) {
  const roomTypes = formData.getAll('bed_room_type').map(String)
  const bedTypes = formData.getAll('bed_type').map(String)
  const quantities = formData.getAll('bed_quantity').map(String)

  await supabase.from('property_beds').delete().eq('property_id', propertyId)

  const rows = bedTypes
    .map((bedType, i) => ({
      property_id: propertyId,
      room_type: roomTypes[i] === 'altillo_tapanco' || roomTypes[i] === 'otro' ? roomTypes[i] : 'recamara',
      bed_type: bedType,
      quantity: Math.max(1, Number(quantities[i]) || 1),
      sort_order: i,
    }))
    .filter((r) => r.bed_type)

  if (rows.length > 0) {
    const { error } = await supabase.from('property_beds').insert(rows)
    if (error) throw new Error(`No se pudieron guardar las camas: ${error.message}`)
  }
}

export async function createProperty(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const host = await requireHost()
  const supabase = await createClient()

  const payload = buildPropertyPayload(formData)
  if (!payload.name) return { error: 'El nombre de la propiedad es obligatorio.' }
  if (payload.weekday_price_mxn <= 0 || payload.weekend_price_mxn <= 0) {
    return { error: 'Define un precio entre semana y fin de semana mayor a 0.' }
  }

  const slug = await generateUniqueSlug(supabase, payload.name)

  const { data: property, error } = await supabase
    .from('properties')
    .insert({ ...payload, host_id: host.id, slug })
    .select('id')
    .single()

  if (error || !property) {
    return { error: `No se pudo crear la propiedad: ${error?.message}` }
  }

  try {
    await syncAmenities(supabase, property.id, formData)
    await syncPhotos(supabase, property.id, formData)
    await syncBeds(supabase, property.id, formData)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error guardando detalles.' }
  }

  revalidatePath('/admin/propiedades')
  redirect(`/admin/propiedades/${property.id}?creada=1`)
}

export async function updateProperty(
  propertyId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const host = await requireHost()
  const supabase = await createClient()

  const payload = buildPropertyPayload(formData)
  if (!payload.name) return { error: 'El nombre de la propiedad es obligatorio.' }

  // Mientras la propiedad siga en borrador (todavía no es pública), su URL se
  // regenera a partir del nombre al renombrarla. Así una cabaña creada con
  // "Duplicar" ("Glasshouse Natural (copia)") y luego renombrada a
  // "Glasshouse Galería" queda en /cabanas/glasshouse-galeria y no en
  // /cabanas/glasshouse-natural-copia-copia-copia. Ya publicada, la URL no
  // se toca para no romper ligas compartidas ni lo indexado por Google.
  const { data: current } = await supabase
    .from('properties')
    .select('name, status')
    .eq('id', propertyId)
    .eq('host_id', host.id)
    .maybeSingle()
  const slugUpdate =
    current && current.status === 'draft' && current.name !== payload.name
      ? { slug: await generateUniqueSlug(supabase, payload.name, propertyId) }
      : {}

  const { error } = await supabase
    .from('properties')
    .update({ ...payload, ...slugUpdate, updated_at: new Date().toISOString() })
    .eq('id', propertyId)
    .eq('host_id', host.id)

  if (error) {
    return { error: `No se pudo guardar: ${error.message}` }
  }

  try {
    await syncAmenities(supabase, propertyId, formData)
    await syncPhotos(supabase, propertyId, formData)
    await syncBeds(supabase, propertyId, formData)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error guardando detalles.' }
  }

  revalidatePath('/admin/propiedades')
  revalidatePath(`/admin/propiedades/${propertyId}`)
  return { error: null }
}

export async function deleteProperty(propertyId: string) {
  const host = await requireHost()
  const supabase = await createClient()

  const { data: photos } = await supabase.from('property_photos').select('url').eq('property_id', propertyId)
  await supabase.from('properties').delete().eq('id', propertyId).eq('host_id', host.id)
  await removeUnreferencedFiles((photos ?? []).map((r) => r.url))

  revalidatePath('/admin/propiedades')
  redirect('/admin/propiedades')
}

// Crea una copia completa de una propiedad (datos, amenidades, fotos y
// camas) como borrador, para no tener que llenar todo de cero cuando una
// cabaña es muy parecida a otra que ya existe. No copia los calendarios
// iCal conectados ni las plantillas de correo — esas son específicas de
// cada propiedad y el anfitrión las configura de nuevo si las necesita.
export async function duplicateProperty(propertyId: string) {
  const host = await requireHost()
  const supabase = await createClient()

  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .eq('host_id', host.id)
    .maybeSingle()
  if (!property) return { error: 'Propiedad no encontrada.' }

  const { id: _id, slug: _slug, created_at: _createdAt, updated_at: _updatedAt, ...rest } =
    property as Record<string, unknown>
  const newName = `${property.name} (copia)`
  const slug = await generateUniqueSlug(supabase, newName)

  const { data: newProperty, error } = await supabase
    .from('properties')
    .insert({ ...rest, name: newName, slug, status: 'draft' })
    .select('id')
    .single()

  if (error || !newProperty) {
    return { error: `No se pudo duplicar la propiedad: ${error?.message}` }
  }

  try {
    const [{ data: amenities }, { data: photos }, { data: beds }] = await Promise.all([
      supabase.from('property_amenities').select('amenity_id, description').eq('property_id', propertyId),
      supabase
        .from('property_photos')
        .select('url, category, description, sort_order')
        .eq('property_id', propertyId),
      supabase
        .from('property_beds')
        .select('room_type, bed_type, quantity, sort_order')
        .eq('property_id', propertyId),
    ])

    if (amenities && amenities.length > 0) {
      await supabase.from('property_amenities').insert(
        amenities.map((a) => ({ property_id: newProperty.id, amenity_id: a.amenity_id, description: a.description }))
      )
    }
    if (photos && photos.length > 0) {
      await supabase.from('property_photos').insert(
        photos.map((p) => ({
          property_id: newProperty.id,
          url: p.url,
          category: p.category,
          description: p.description,
          sort_order: p.sort_order,
        }))
      )
    }
    if (beds && beds.length > 0) {
      await supabase.from('property_beds').insert(
        beds.map((b) => ({
          property_id: newProperty.id,
          room_type: b.room_type,
          bed_type: b.bed_type,
          quantity: b.quantity,
          sort_order: b.sort_order,
        }))
      )
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error copiando los detalles de la propiedad.' }
  }

  revalidatePath('/admin/propiedades')
  redirect(`/admin/propiedades/${newProperty.id}?duplicada=1`)
}
