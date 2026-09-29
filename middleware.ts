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
//
// Vista previa para Christian: entrando una vez a
// https://huascaretreats.com/?preview=huasca2026 se guarda una cookie en su
// navegador y desde ahi ve el sitio real (aunque siga en mantenimiento para
// todos los demas), sin apagar el modo mantenimiento.
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

const PREVIEW_CODE = 'huasca2026'
const PREVIEW_COOKIE = 'huasca_preview'

export function middleware(request: NextRequest) {
  if (process.env.MAINTENANCE_MODE !== 'true') return NextResponse.next()

  const { pathname, searchParams } = request.nextUrl
  if (ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  if (searchParams.get('preview') === PREVIEW_CODE) {
    const url = request.nextUrl.clone()
    url.searchParams.delete('preview')
    const res = NextResponse.redirect(url)
    res.cookies.set(PREVIEW_COOKIE, PREVIEW_CODE, {
      maxAge: 60 * 60 * 24 * 30,
      httpOnly: true,
      sameSite: 'lax',
    })
    return res
  }

  if (request.cookies.get(PREVIEW_COOKIE)?.value === PREVIEW_CODE) {
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
