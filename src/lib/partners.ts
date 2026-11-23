// Socios: dueños de cabañas que no son de Huasca Retreats y publican su
// espacio en el sitio (como un Airbnb). Cada socio tiene su propio panel en
// /socios, con acceso SOLO a sus cabañas.
//
// Dinero: el socio pone su precio por noche; el huésped paga ese precio +14%
// (lo guardamos ya con el 14% en weekday_price_mxn / weekend_price_mxn para
// que todo el sitio — búsqueda, calendario, checkout — funcione igual que
// con las cabañas propias). Al socio se le paga su precio −5%, al día
// siguiente del check-in. El cálculo del pago lo hace un trigger en la base
// (set_partner_payout) al crear la reserva.
//
// La tabla partners no tiene políticas de RLS: todo pasa por el servidor con
// la service key, y aquí es donde se revisa quién es el socio.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendEmail } from '@/lib/email'
import { wrapBrandedEmail } from '@/lib/booking-emails'
import { LOGO_CID, LOGO_PNG_BASE64 } from '@/lib/email-logo'

export const PARTNER_MARKUP_PCT = 14
export const PARTNER_FEE_PCT = 5

export type Partner = {
  id: string
  user_id: string
  name: string
  email: string
  phone: string | null
  status: 'active' | 'suspended'
  bank_holder: string | null
  bank_name: string | null
  bank_clabe: string | null
  bank_rfc: string | null
  bank_proof_path: string | null
  bank_updated_at: string | null
  bank_verified_at: string | null
  terms_accepted_at: string | null
  admin_notes: string | null
  created_at: string
}

/** Precio que ve y paga el huésped, a partir del precio del socio. */
export function guestPrice(partnerPrice: number, markupPct = PARTNER_MARKUP_PCT) {
  return Math.round((partnerPrice * (1 + markupPct / 100)) / 10) * 10
}

/** Lo que recibe el socio por noche, a partir de su propio precio. */
export function partnerNet(partnerPrice: number, feePct = PARTNER_FEE_PCT) {
  return Math.round(partnerPrice * (1 - feePct / 100))
}

export async function findPartnerByUserId(userId: string) {
  const service = createServiceClient()
  const { data } = await service.from('partners').select('*').eq('user_id', userId).maybeSingle()
  return (data as Partner | null) ?? null
}

/** Para las páginas de /socios: exige sesión de un socio. */
export async function requirePartner(): Promise<Partner> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/socios')
  const partner = await findPartnerByUserId(user.id)
  if (!partner) redirect('/admin')
  if (partner.status === 'suspended') {
    await supabase.auth.signOut()
    redirect('/login?desactivado=1')
  }
  return partner
}

/** Revisa que la cabaña sea de este socio. Regresa la fila o null. */
export async function partnerProperty(partnerId: string, propertyId: string) {
  const service = createServiceClient()
  const { data } = await service
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .eq('partner_id', partnerId)
    .maybeSingle()
  return data
}

// ---- CLABE -----------------------------------------------------------------
// 18 dígitos: 3 de banco, 3 de plaza, 11 de cuenta y 1 verificador. El
// verificador se calcula con pesos 3,7,1 sobre los primeros 17 dígitos.
export const BANKS: Record<string, string> = {
  '002': 'Banamex',
  '006': 'Bancomext',
  '012': 'BBVA México',
  '014': 'Santander',
  '019': 'Banjército',
  '021': 'HSBC',
  '030': 'Banco del Bajío',
  '036': 'Inbursa',
  '042': 'Mifel',
  '044': 'Scotiabank',
  '058': 'Banregio',
  '059': 'Invex',
  '060': 'Bansi',
  '062': 'Afirme',
  '072': 'Banorte',
  '106': 'Bank of America',
  '113': 'Ve por Más',
  '127': 'Banco Azteca',
  '130': 'Compartamos',
  '132': 'Multiva',
  '133': 'Actinver',
  '137': 'BanCoppel',
  '138': 'ABC Capital',
  '140': 'Consubanco',
  '143': 'CIBanco',
  '145': 'Bancrea',
  '147': 'Bankaool',
  '148': 'Pagatodo',
  '150': 'Inmobiliario Mexicano',
  '152': 'Bancrea',
  '156': 'Sabadell',
  '166': 'Banco del Bienestar',
  '167': 'Hey Banco',
  '168': 'Hipotecaria Federal',
  '638': 'Nu México',
  '646': 'STP',
  '652': 'Credicapital',
  '653': 'Kuspit',
  '656': 'Unagra',
  '659': 'Opciones Empresariales del Noreste',
  '661': 'Klar',
  '670': 'Libertad',
  '684': 'Transfer',
  '699': 'Fondeadora',
  '703': 'Tesored',
  '710': 'NVIO',
  '722': 'Mercado Pago',
  '728': 'Spin by OXXO',
  '730': 'Swap',
}

export function validateClabe(raw: string): { ok: true; clabe: string; bank: string | null } | { ok: false; error: string } {
  const clabe = raw.replace(/\s|-/g, '')
  if (!/^\d{18}$/.test(clabe)) return { ok: false, error: 'La CLABE debe tener exactamente 18 números.' }
  const weights = [3, 7, 1]
  let sum = 0
  for (let i = 0; i < 17; i++) sum += (Number(clabe[i]) * weights[i % 3]) % 10
  const check = (10 - (sum % 10)) % 10
  if (check !== Number(clabe[17])) {
    return { ok: false, error: 'Esa CLABE no es válida (el dígito verificador no coincide). Revísala con tu banco o tu estado de cuenta.' }
  }
  return { ok: true, clabe, bank: BANKS[clabe.slice(0, 3)] ?? null }
}

export function maskClabe(clabe: string | null) {
  return clabe ? `•••• ${clabe.slice(-4)}` : '—'
}

// ---- Correos ---------------------------------------------------------------
export async function adminEmail() {
  const service = createServiceClient()
  const { data } = await service.from('hosts').select('id, email, name').order('created_at').limit(1).maybeSingle()
  return data as { id: string; email: string; name: string } | null
}

/** Correo simple con la marca de Huasca Retreats. Nunca lanza error. */
export async function sendPlainEmail(to: string | string[], subject: string, paragraphs: string[]) {
  try {
    const html = wrapBrandedEmail(
      paragraphs.map((p) => `<p style="margin:0 0 16px 0;">${p.replace(/\n/g, '<br />')}</p>`).join('')
    )
    await sendEmail({
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      attachments: [
        { filename: 'huasca-retreats.png', content: Buffer.from(LOGO_PNG_BASE64, 'base64'), cid: LOGO_CID, contentType: 'image/png' },
      ],
    })
  } catch {
    // los avisos nunca deben tronar una acción
  }
}

export async function notifyAdmin(subject: string, paragraphs: string[]) {
  const admin = await adminEmail()
  if (admin?.email) await sendPlainEmail(admin.email, subject, paragraphs)
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

export function mxn(n: number) {
  return `$${Math.round(n).toLocaleString('es-MX')} MXN`
}
