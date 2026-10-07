// En Next.js 16, "middleware.ts" se renombró a "proxy.ts" (misma función).
// Aquí refrescamos la sesión de Supabase y protegemos /admin.
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Aplica a todas las rutas excepto archivos estáticos e imágenes,
     * para no interferir con el rendimiento de assets.
     */
    '/((?!_next/static|_next/image|media/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4)$).*)',
  ],
}
