import { redirect } from 'next/navigation'
import { currentTeamOwner, listTeam } from '@/lib/team'
import TeamManager from '../TeamManager'

export const dynamic = 'force-dynamic'

export default async function MiEquipoPage() {
  const owner = await currentTeamOwner()
  if (!owner || owner.kind !== 'staff') redirect('/equipo')
  const members = await listTeam(owner)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-navy-deep">Mi equipo</h1>
        <p className="text-sm text-stone mt-1">
          Dale acceso a tu gente (quien limpia, el encargado…) para que vea el calendario de tus cabañas desde su celular en
          huascaretreats.com/equipo. Cada quien entra con su propio correo y contraseña, y puedes quitarle el acceso cuando quieras.
        </p>
      </div>
      <TeamManager properties={owner.properties} perms={owner.perms} members={members} />
    </div>
  )
}
