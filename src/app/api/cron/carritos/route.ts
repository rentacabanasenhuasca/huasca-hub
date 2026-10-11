// Revisa carritos abandonados (ver src/lib/carts.ts). En el servidor de
// Coolify ya corre solo cada 5 minutos desde instrumentation.ts; este
// endpoint es por si algún día el sitio se mueve a una plataforma
// serverless y hay que llamarlo desde un cron externo. Mismo esquema de
// protección que /api/cron/sync-ical (CRON_SECRET).
import { NextRequest, NextResponse } from 'next/server'
import { processAbandonedCarts } from '@/lib/carts'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
    }
  }
  return NextResponse.json(await processAbandonedCarts())
}
