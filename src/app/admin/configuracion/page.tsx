import { requireHost } from '@/lib/hosts'
import SettingsForm from './SettingsForm'

export default async function ConfiguracionPage() {
  const host = await requireHost()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-navy-deep">Configuración</h1>
        <p className="text-sm text-stone mt-1">
          Datos del anfitrión que usa el sitio público — como el número de WhatsApp del botón
          flotante. Si en el futuro este mismo sitio se usa para otro hospedaje, aquí es donde se
          personaliza sin tocar código.
        </p>
      </div>
      <SettingsForm name={host.name} phone={host.phone} email={host.email} />
    </div>
  )
}
