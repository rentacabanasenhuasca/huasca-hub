import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Modo mantenimiento de emergencia: cuando MAINTENANCE_MODE=true en las
// variables de entorno (Coolify), manda todo el trafico publico a
// /mantenimiento (pagina con boton de WhatsApp) para frenar reservas nuevas
// mientras Christian pone el sistema en orden. El panel /admin, las rutas
// /api (ical de OTAs, webhooks de pago) y los archivos estaticos siguen
// funcionando normal.
//
// Para activar/desactivar: solo cambiar MAINTENANCE_MODE en Coolify y
// redeploy. No requiere tocar ni volver a subir codigo.
const ALLOWED_PREFIXES = [
  '/mantenimiento',
  '/admin',
  '/login',
  '/api',
  '/_next',
  '/favicon.ico',
  '/logo.png',
  '/robots.txt',
  '/sitemap.xml',
  '/llms.txt',
]

export function middleware(request: NextRequest) {
  if (process.env.MAINTENANCE_MODE !== 'true') return NextResponse.next()

  const { pathname } = request.nextUrl
  if (ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  const url = request.nextUrl.clone()
  url.pathname = '/mantenimiento'
  url.search = ''
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
