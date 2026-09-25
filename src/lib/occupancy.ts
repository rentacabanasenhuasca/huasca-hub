// Cálculo de quién "cuenta" para la ocupación de una cabaña, compartido
// entre el buscador público y la página de cada cabaña.
//
// Regla de Christian: niños desde 3 años SIEMPRE cuentan como huésped
// (capacidad y cobro por persona extra). Los infantes (<3) solo cuentan si
// la propiedad los cuenta (infants_count_toward_capacity) — configurable
// por cabaña.

export type OccupancyProperty = {
  capacity: number
  base_occupancy: number
  max_children: number | null
  max_infants: number | null
  infants_count_toward_capacity: boolean
  pet_friendly: boolean
}

export type GuestCounts = {
  adults: number
  children: number
  infants: number
  pets: number
}

export function occupantsFor(property: OccupancyProperty, guests: GuestCounts) {
  const countedInfants = property.infants_count_toward_capacity ? guests.infants : 0
  return guests.adults + guests.children + countedInfants
}

export function fitsProperty(property: OccupancyProperty, guests: GuestCounts) {
  if (occupantsFor(property, guests) > property.capacity) return false
  if (property.max_children != null && guests.children > property.max_children) return false
  if (property.max_infants != null && guests.infants > property.max_infants) return false
  if (guests.pets > 0 && !property.pet_friendly) return false
  return true
}

export function extraGuestsFor(property: OccupancyProperty, guests: GuestCounts) {
  return Math.max(0, occupantsFor(property, guests) - property.base_occupancy)
}

export function parseGuestsFromParams(params: {
  adults?: string
  children?: string
  infants?: string
  pets?: string
  guests?: string // compatibilidad con el buscador viejo (un solo campo)
}): GuestCounts {
  const adults =
    params.adults != null
      ? Math.max(1, Number(params.adults))
      : params.guests != null
        ? Math.max(1, Number(params.guests))
        : 2
  const children = params.children != null ? Math.max(0, Number(params.children)) : 0
  const infants = params.infants != null ? Math.max(0, Number(params.infants)) : 0
  const pets = params.pets != null ? Math.max(0, Number(params.pets)) : 0
  return { adults, children, infants, pets }
}

export function guestsSummary(guests: GuestCounts) {
  const parts = [`${guests.adults} ${guests.adults === 1 ? 'adulto' : 'adultos'}`]
  if (guests.children > 0) parts.push(`${guests.children} ${guests.children === 1 ? 'niño' : 'niños'}`)
  if (guests.infants > 0) parts.push(`${guests.infants} ${guests.infants === 1 ? 'infante' : 'infantes'}`)
  if (guests.pets > 0) parts.push(`${guests.pets} ${guests.pets === 1 ? 'mascota' : 'mascotas'}`)
  return parts.join(' · ')
}
