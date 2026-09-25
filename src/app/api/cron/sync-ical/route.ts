// Endpoint para disparar la sincronización de calendarios externos
// (Airbnb, Booking, etc.) desde un cron externo, en lugar del
// setInterval de instrumentation.ts (que solo funciona en un servidor
// que vive corriendo, no en Vercel u otra plataforma serverless).
//
// Protegido con CRON_SECRET: solo responde si el llamador manda
// "Authorization: Bearer <CRON_SECRET>". Vercel Cron manda ese header
// automáticamente en cada plan (incluido el gratuito); un cron externo
// (cron-job.org, por ejemplo) hay que configurarlo para que lo mande.
import { NextRequest, NextResponse } from 'next/server'
import { syncAllIcalSourcesGlobally } from '@/lib/ical-sync'

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

  const result = await syncAllIcalSourcesGlobally()
  return NextResponse.json(result)
}
