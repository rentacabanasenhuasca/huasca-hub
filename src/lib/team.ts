// Equipo propio de un colaborador o socio (ver src/app/equipo/team-actions.ts).
// Este archivo NO es 'use server' a propósito: estas funciones solo se
// llaman desde el servidor y no deben quedar expuestas como acciones.
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { findStaffByUserId } from '@/lib/staff'
import { findPartnerByUserId } from '@/lib/partners'

export type TeamOwner = {
  kind: 'staff' | 'partner'
  id: string
  name: string
  hostId: string
  properties: { id: string; name: string }[]
  perms: { can_block_dates: boolean; can_view_bookings: boolean; can_view_guest_contact: boolean }
}

export type TeamMemberView = {
  id: string
  name: string
  email: string
  active: boolean
  can_block_dates: boolean
  can_view_bookings: boolean
  can_view_guest_contact: boolean
  property_ids: string[]
}

/** Quién está pidiendo manejar equipo, con sus cabañas y permisos. */
export async function currentTeamOwner(): Promise<TeamOwner | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const service = createServiceClient()

  const staff = await findStaffByUserId(user.id)
  if (staff) {
    if (!staff.active || !staff.can_manage_team || staff.created_by_staff_id || staff.created_by_partner_id) return null
    const { data: access } = await service.from('staff_property_access').select('properties(id, name)').eq('staff_id', staff.id)
    const properties = (access ?? [])
      .map((a) => (Array.isArray(a.properties) ? a.properties[0] : a.properties) as { id: string; name: string } | null)
      .filter((p): p is { id: string; name: string } => Boolean(p))
    return {
      kind: 'staff',
      id: staff.id,
      name: staff.name,
      hostId: staff.host_id,
      properties,
      perms: {
        can_block_dates: staff.can_block_dates,
        can_view_bookings: staff.can_view_bookings,
        can_view_guest_contact: staff.can_view_guest_contact,
      },
    }
  }

  const partner = await findPartnerByUserId(user.id)
  if (partner && partner.status !== 'suspended') {
    const { data: props } = await service
      .from('properties')
      .select('id, name, host_id')
      .eq('partner_id', partner.id)
      .neq('partner_state', 'removed')
      .order('name')
    const hostId = (props ?? [])[0]?.host_id as string | undefined
    if (!hostId) return { kind: 'partner', id: partner.id, name: partner.name, hostId: '', properties: [], perms: allPerms() }
    return {
      kind: 'partner',
      id: partner.id,
      name: partner.name,
      hostId,
      properties: (props ?? []).map((p) => ({ id: p.id as string, name: p.name as string })),
      perms: allPerms(),
    }
  }
  return null
}

function allPerms() {
  return { can_block_dates: true, can_view_bookings: true, can_view_guest_contact: true }
}

export function ownerColumn(owner: TeamOwner) {
  return owner.kind === 'staff' ? 'created_by_staff_id' : 'created_by_partner_id'
}

/** Miembros del equipo de quien pregunta. */
export async function listTeam(owner: TeamOwner): Promise<TeamMemberView[]> {
  const service = createServiceClient()
  const { data: members } = await service
    .from('staff_members')
    .select('*')
    .eq(ownerColumn(owner), owner.id)
    .order('created_at')
  const ids = (members ?? []).map((m) => m.id)
  const { data: access } = ids.length
    ? await service.from('staff_property_access').select('staff_id, property_id').in('staff_id', ids)
    : { data: [] as { staff_id: string; property_id: string }[] }
  return (members ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    active: m.active,
    can_block_dates: m.can_block_dates,
    can_view_bookings: m.can_view_bookings,
    can_view_guest_contact: m.can_view_guest_contact,
    property_ids: (access ?? []).filter((a) => a.staff_id === m.id).map((a) => a.property_id),
  }))
}

