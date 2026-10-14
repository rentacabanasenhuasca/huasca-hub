'use server'

// Bloqueos hechos por colaboradores desde /equipo. Solo tocan bloqueos
// manuales (source='manual'): nunca pisan una reserva ni un bloqueo que
// venga de Airbnb/iCal. Los bloqueos manuales salen en el iCal que lee
// Airbnb, así que se sincronizan solos.
import { revalidatePath } from 'next/cache'
import { requireStaff } from '@/lib/staff'
import { createServiceClient } from '@/lib/supabase/service'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function staffSetBlock(
  propertyId: string,
  dates: string[],
  blocked: boolean,
  note?: string | null
): Promise<{ error: string | null }> {
  const staff = await requireStaff()
  if (!staff.can_block_dates) return { error: 'No tienes permiso para bloquear fechas.' }
  if (!staff.properties.some((p) => p.id === propertyId)) return { error: 'No tienes acceso a esa propiedad.' }

  const clean = [...new Set(dates.filter((d) => DATE_RE.test(d)))]
  if (clean.length === 0) return { error: 'No hay fechas seleccionadas.' }
  if (clean.length > 400) return { error: 'Demasiadas fechas a la vez.' }

  const service = createServiceClient()

  if (blocked) {
    const { data: existing } = await service
      .from('blocked_dates')
      .select('date, source')
      .eq('property_id', propertyId)
      .in('date', clean)
    const taken = new Set((existing ?? []).filter((r) => r.source !== 'manual').map((r) => r.date))
    const text = note?.trim() ? `${note.trim()} — por ${staff.name}` : `Bloqueado por ${staff.name}`
    const rows = clean
      .filter((d) => !taken.has(d))
      .map((date) => ({ property_id: propertyId, date, source: 'manual' as const, note: text }))
    if (rows.length === 0) return { error: 'Esas fechas ya están ocupadas por una reserva o por otra plataforma.' }
    const { error } = await service.from('blocked_dates').upsert(rows, { onConflict: 'property_id,date' })
    if (error) return { error: `No se pudo bloquear: ${error.message}` }
  } else {
    const { error } = await service
      .from('blocked_dates')
      .delete()
      .eq('property_id', propertyId)
      .eq('source', 'manual')
      .in('date', clean)
    if (error) return { error: `No se pudo desbloquear: ${error.message}` }
  }

  revalidatePath('/equipo')
  revalidatePath('/admin/calendario')
  return { error: null }
}
