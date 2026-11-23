// Cambios a una reserva por fuera ya anotada: actualizar lo que pagó / debe y
// moverla a otra cabaña. Los permisos (quién puede tocar qué estancia y qué
// cabañas) se revisan en las acciones de /equipo y /socios antes de llamar aquí.
import type { SupabaseClient } from '@supabase/supabase-js'

function money(v: number | null) {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
}

export async function loadStay(service: SupabaseClient, stayId: string) {
  const { data } = await service
    .from('manual_stays')
    .select('id, property_id, owner_key, guest_name')
    .eq('id', stayId)
    .maybeSingle()
  return data as { id: string; property_id: string; owner_key: string; guest_name: string } | null
}

export async function updateStayPayment(service: SupabaseClient, stayId: string, paid: number | null, balance: number | null) {
  const { error } = await service
    .from('manual_stays')
    .update({ paid_mxn: money(paid), balance_mxn: money(balance) })
    .eq('id', stayId)
  return { error: error ? `No se pudo guardar: ${error.message}` : null }
}

function fmt(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** Pasa las noches de la estancia a otra cabaña (si esas noches están libres allá). */
export async function moveStay(service: SupabaseClient, stayId: string, targetPropertyId: string, who: string) {
  const { data: rows } = await service
    .from('blocked_dates')
    .select('property_id, date, note')
    .eq('stay_id', stayId)
    .eq('source', 'manual')
    .order('date')
  const nights = rows ?? []
  if (nights.length === 0) return { error: 'Esa reserva ya no tiene noches bloqueadas.' }
  const fromProperty = nights[0].property_id as string
  if (fromProperty === targetPropertyId) return { error: 'La reserva ya está en esa cabaña.' }
  const dates = nights.map((r) => r.date as string)

  const { data: taken } = await service
    .from('blocked_dates')
    .select('date')
    .eq('property_id', targetPropertyId)
    .in('date', dates)
  if (taken && taken.length > 0) {
    return { error: `La otra cabaña ya está ocupada: ${taken.map((t) => fmt(t.date as string)).join(', ')}.` }
  }

  // Primero se ocupan las noches en la cabaña nueva (así la estancia nunca se
  // queda sin noches y no la borra el trigger de limpieza), luego se liberan
  // las de la cabaña anterior.
  const { error: insErr } = await service.from('blocked_dates').insert(
    nights.map((r) => ({
      property_id: targetPropertyId,
      date: r.date,
      source: 'manual',
      note: r.note,
      blocked_by: who,
      stay_id: stayId,
    }))
  )
  if (insErr) return { error: `No se pudo mover: ${insErr.message}` }
  await service.from('manual_stays').update({ property_id: targetPropertyId }).eq('id', stayId)
  await service
    .from('blocked_dates')
    .update({ blocked_by: who })
    .eq('property_id', fromProperty)
    .eq('stay_id', stayId)
  await service.from('blocked_dates').delete().eq('property_id', fromProperty).eq('stay_id', stayId)
  return { error: null }
}
