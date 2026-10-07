// Sirve archivos públicos de Supabase Storage (sobre todo el video de la
// portada) desde nuestro servidor: se descargan de Supabase UNA vez y se
// guardan en memoria, en vez de que cada visitante los baje de Supabase
// (eso fue lo que agotó la cuota de salida del plan gratis). Soporta
// peticiones "Range" porque Safari/iPhone no reproduce video sin ellas.
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'

const ALLOWED_BUCKETS = new Set(['site-media', 'property-photos'])
const MAX_FILE_BYTES = 40 * 1024 * 1024 // no cacheamos archivos más grandes
const MAX_TOTAL_BYTES = 250 * 1024 * 1024 // tope de memoria para la caché

type Entry = { buf: Buffer; type: string }
const cache = new Map<string, Entry>()
const inflight = new Map<string, Promise<Entry | null>>()
let totalBytes = 0

async function load(key: string): Promise<Entry | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  const res = await fetch(`${base}/storage/v1/object/public/${key}`, { cache: 'no-store' })
  if (!res.ok) return null
  const buf = Buffer.from(await res.arrayBuffer())
  const entry = { buf, type: res.headers.get('content-type') ?? 'application/octet-stream' }
  if (buf.length <= MAX_FILE_BYTES && totalBytes + buf.length <= MAX_TOTAL_BYTES) {
    cache.set(key, entry)
    totalBytes += buf.length
  }
  return entry
}

async function getEntry(key: string) {
  const hit = cache.get(key)
  if (hit) return hit
  let p = inflight.get(key)
  if (!p) {
    p = load(key).finally(() => inflight.delete(key))
    inflight.set(key, p)
  }
  return p
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  if (!path?.length || !ALLOWED_BUCKETS.has(path[0]) || path.some((p) => p === '..' || p === '.')) {
    return new Response('Not found', { status: 404 })
  }
  const key = path.map(encodeURIComponent).join('/')
  const entry = await getEntry(key)
  if (!entry) return new Response('Not found', { status: 404 })

  const size = entry.buf.length
  const headers: Record<string, string> = {
    'Content-Type': entry.type,
    'Accept-Ranges': 'bytes',
    // Los archivos se suben con nombre único (uuid), nunca cambian.
    'Cache-Control': 'public, max-age=31536000, immutable',
  }

  const range = request.headers.get('range')
  const m = range?.match(/^bytes=(\d*)-(\d*)$/)
  if (m && (m[1] || m[2])) {
    let start: number
    let end: number
    if (m[1]) {
      start = Number(m[1])
      end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1
    } else {
      start = Math.max(size - Number(m[2]), 0)
      end = size - 1
    }
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } })
    }
    return new Response(new Uint8Array(entry.buf.subarray(start, end + 1)), {
      status: 206,
      headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
    })
  }

  return new Response(new Uint8Array(entry.buf), {
    status: 200,
    headers: { ...headers, 'Content-Length': String(size) },
  })
}
