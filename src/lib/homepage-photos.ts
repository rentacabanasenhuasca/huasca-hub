// Fotos de las secciones de la portada: "Hecho para bajar el ritmo"
// (historia), el mosaico de "Un día en Huasca" (4 fotos) y "Quédate unos
// días" (cierre). El anfitrión puede elegir cada una en /admin/portada; las
// que no elija salen automáticamente de las fotos de portada de las cabañas.

export const HOMEPAGE_SLOT_INFO = [
  { slot: 'historia', label: 'Sección "Hecho para bajar el ritmo"', hint: 'Foto vertical, a un lado del texto.' },
  { slot: 'mosaico_1', label: '"Un día en Huasca": foto 1', hint: 'Arriba a la izquierda (cuadrada).' },
  { slot: 'mosaico_2', label: '"Un día en Huasca": foto 2', hint: 'Abajo a la izquierda (horizontal).' },
  { slot: 'mosaico_3', label: '"Un día en Huasca": foto 3', hint: 'Arriba a la derecha (horizontal).' },
  { slot: 'mosaico_4', label: '"Un día en Huasca": foto 4', hint: 'Abajo a la derecha (cuadrada).' },
  { slot: 'cierre', label: 'Sección final "Quédate unos días"', hint: 'Foto horizontal de fondo, a todo lo ancho.' },
] as const

export type HomepageSlotKey = (typeof HOMEPAGE_SLOT_INFO)[number]['slot']

type Photo = { property_id: string; url: string }

// Primera foto de cada cabaña publicada, en el mismo orden que la portada.
export function ambientFromCabins(propertyIdsInOrder: string[], photos: Photo[]) {
  const first = new Map<string, string>()
  for (const p of photos) if (!first.has(p.property_id)) first.set(p.property_id, p.url)
  return propertyIdsInOrder.map((id) => first.get(id)).filter((u): u is string => Boolean(u))
}

// Foto final de cada lugar: la elegida por el anfitrión o la automática.
export function resolveHomepagePhotos(
  ambient: string[],
  heroFirstImage: string | null,
  chosen: { slot: string; url: string }[]
): Record<HomepageSlotKey, string | null> {
  const pick = (i: number) => (ambient.length ? ambient[i % ambient.length] : null)
  const auto: Record<HomepageSlotKey, string | null> = {
    historia: pick(4),
    mosaico_1: pick(9),
    mosaico_2: pick(2),
    mosaico_3: pick(7),
    mosaico_4: pick(5),
    cierre: heroFirstImage ?? pick(1),
  }
  for (const c of chosen) if (c.slot in auto) auto[c.slot as HomepageSlotKey] = c.url
  return auto
}
