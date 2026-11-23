import { requirePartner, BANKS } from '@/lib/partners'
import { savePartnerBank } from '../../actions'
import BankForm from './BankForm'

export const dynamic = 'force-dynamic'

export default async function DatosPage() {
  const partner = await requirePartner()
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-navy-deep">Datos de pago</h1>
        <p className="text-sm text-stone mt-1">
          Aquí te depositamos lo de tus reservas, al día siguiente del check-in. Revisamos que la cuenta coincida con tu comprobante antes del
          primer pago, para evitar errores.
        </p>
      </div>
      <BankForm
        action={savePartnerBank}
        userId={partner.user_id}
        banks={BANKS}
        initial={{
          bank_holder: partner.bank_holder ?? '',
          bank_clabe: partner.bank_clabe ?? '',
          bank_rfc: partner.bank_rfc ?? '',
          bank_proof_path: partner.bank_proof_path ?? '',
        }}
        verified={Boolean(partner.bank_verified_at)}
      />
    </div>
  )
}
