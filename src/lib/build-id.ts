// Identificador de la versión publicada (lo genera `next build` en
// .next/BUILD_ID). Sirve para avisar en el panel cuando se publica una
// versión nueva mientras alguien tiene la página abierta: si siguiera
// trabajando con la versión vieja, sus cambios no se guardarían.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let cached: string | null | undefined

export function getBuildId(): string | null {
  if (cached !== undefined) return cached
  try {
    cached = readFileSync(join(process.cwd(), '.next', 'BUILD_ID'), 'utf8').trim() || null
  } catch {
    cached = null
  }
  return cached
}
