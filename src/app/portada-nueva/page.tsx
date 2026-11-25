import { redirect } from 'next/navigation'

// La vista previa ya es la portada oficial.
export default function PortadaNueva() {
  redirect('/')
}
