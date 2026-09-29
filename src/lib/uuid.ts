// crypto.randomUUID() solo existe en "contextos seguros" (HTTPS o
// localhost) — en la URL temporal de Coolify (HTTP plano, antes de
// conectar el dominio con SSL) esto rompe cualquier página que lo use al
// cargar. Este helper usa crypto.randomUUID() cuando está disponible y cae
// a un generador manual (no criptográfico, pero suficiente para IDs de
// UI/nombres de archivo) cuando no lo está.
export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
