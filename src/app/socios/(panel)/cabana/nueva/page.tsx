import Link from 'next/link'
import { requirePartner, PARTNER_FEE_PCT } from '@/lib/partners'
import { savePartnerProperty } from '../../../actions'
import PartnerPropertyForm from '../PartnerPropertyForm'
import { EMPTY_VALUES, loadAmenities } from '../load'

export const dynamic = 'force-dynamic'

export default async function NuevaCabanaPage() {
  const partner = await requirePartner()
  const amenities = await loadAmenities()

  return (
    <div className="space-y-4">
      <Link href="/socios" className="text-xs text-stone hover:text-navy-deep">← Mis cabañas</Link>
      <div>
        <h1 className="text-xl font-semibold text-navy-deep">Registrar mi cabaña</h1>
        <p className="text-sm text-stone mt-1">
          Llena los datos y sube tus fotos. Revisamos tu espacio y te avisamos por correo cuando quede publicado.
        </p>
      </div>
      <PartnerPropertyForm
        action={savePartnerProperty.bind(null, null)}
        userId={partner.user_id}
        amenities={amenities}
        initial={EMPTY_VALUES}
        feePct={PARTNER_FEE_PCT}
        submitLabel="Enviar a revisión"
      />
    </div>
  )
}
