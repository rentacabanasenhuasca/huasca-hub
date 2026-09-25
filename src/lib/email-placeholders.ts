// Lista de placeholders disponibles en las plantillas de correo — vive en
// su propio archivo (sin ningún import) a propósito: EmailTemplates.tsx (un
// componente de cliente, para mostrar esta lista en el panel) la necesita,
// y booking-emails.ts (que sí corre solo en el servidor y usa nodemailer)
// también. Si esto viviera dentro de booking-emails.ts, el navegador
// intentaría incluir nodemailer en su paquete — y nodemailer usa partes
// internas de Node (como "node:net") que no existen en el navegador, lo
// que tronaba la página con "Turbopack error... does not support external
// modules (request: node:net)".
export const EMAIL_PLACEHOLDERS: { key: string; label: string }[] = [
  { key: 'guest_name', label: 'Nombre del huésped' },
  { key: 'guest_email', label: 'Correo del huésped' },
  { key: 'guest_phone', label: 'Teléfono del huésped' },
  { key: 'guest_notes', label: 'Notas del huésped' },
  { key: 'property_name', label: 'Nombre de la cabaña' },
  { key: 'check_in', label: 'Fecha de llegada' },
  { key: 'check_out', label: 'Fecha de salida' },
  { key: 'nights', label: 'Número de noches' },
  { key: 'adults', label: 'Adultos' },
  { key: 'children', label: 'Niños' },
  { key: 'infants', label: 'Infantes' },
  { key: 'pets', label: 'Mascotas (sí/no)' },
  { key: 'total', label: 'Total pagado (MXN)' },
  { key: 'payment_provider', label: 'Método de pago' },
  { key: 'booking_id', label: 'ID de la reserva' },
  { key: 'host_name', label: 'Tu nombre (anfitrión)' },
  { key: 'host_email', label: 'Tu correo' },
  { key: 'host_phone', label: 'Tu teléfono' },
]
