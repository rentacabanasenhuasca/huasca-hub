import { redirect } from 'next/navigation'
import { currentTeamOwner, listTeam } from '@/lib/team'
import TeamManager from '@/app/equipo/TeamManager'

export const dynamic = 'force-dynamic'

export default async function SocioEquipoPage() {
  const owner = await currentTeamOwner()
  if (!owner || owner.kind !== 'partner') redirect('/socios')
  const members = await listTeam(owner)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-navy-deep">Mi equipo</h1>
        <p className="text-sm text-stone mt-1">
          Dale acceso a tu gente (quien limpia, el encargado…) para que vea el calendario de tus cabañas, bloquee fechas y anote a los
          huéspedes que reserven por fuera. Entran en huascaretreats.com/equipo con su propio correo y contraseña. No ven tus pagos ni tus
          datos bancarios.
        </p>
      </div>
      <TeamManager properties={owner.properties} perms={owner.perms} members={members} />
    </div>
  )
}
