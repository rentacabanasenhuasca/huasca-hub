import { getBuildId } from '@/lib/build-id'

// Versión que está corriendo ahora en el servidor (ver src/lib/build-id.ts).
export const dynamic = 'force-dynamic'

export function GET() {
  return new Response(getBuildId() ?? '', {
    headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store, max-age=0' },
  })
}
