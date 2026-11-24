import { createServiceClient } from '@/lib/supabase/service'
import type { PartnerPropertyValues } from './PartnerPropertyForm'

export async function loadAmenities() {
  const service = createServiceClient()
  const { data } = await service.from('amenities').select('id, category, label, sort_order').order('category').order('sort_order')
  return (data ?? []).map((a) => ({ id: a.id as string, category: a.category as string, label: a.label as string }))
}

// La descripción pública se guarda como "texto\n\nUbicación: …\n\nServicios: …";
// aquí se separa otra vez para el formulario.
export function splitDescription(full: string | null) {
  let description = full ?? ''
  let location = ''
  let services = ''
  const s = description.match(/\n\nServicios: ([\s\S]*)$/)
  if (s) {
    services = s[1].trim()
    description = description.slice(0, s.index)
  }
  const l = description.match(/\n\nUbicación: ([\s\S]*)$/)
  if (l) {
    location = l[1].trim()
    description = description.slice(0, l.index)
  }
  return { description: description.trim(), location, services }
}

export const EMPTY_VALUES: PartnerPropertyValues = {
  name: '',
  description: '',
  location_text: '',
  services_text: '',
  google_maps_link: '',
  arrival_instructions: '',
  capacity: 2,
  bedrooms: 1,
  beds: 1,
  bathrooms: 1,
  pet_friendly: false,
  min_nights: 1,
  partner_price_weekday: '',
  partner_price_weekend: '',
  amenity_ids: [],
  photos: [],
  bed_rows: [],
}
