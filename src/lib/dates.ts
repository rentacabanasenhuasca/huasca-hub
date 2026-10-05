// Ayudante centralizado para saber "qué día es hoy" de forma consistente,
// sin importar si el código corre en el navegador del huésped o en el
// servidor (Hetzner, que corre en UTC).
//
// El bug que esto arregla: `new Date().toISOString().slice(0, 10)` siempre
// da la fecha en UTC, nunca en la hora local de México. Desde las ~6pm hora
// CDMX (UTC-6) en adelante, en UTC ya es el día siguiente — así que el
// buscador calculaba "hoy" como mañana y rechazaba búsquedas válidas para
// el mismo día con el error nativo del navegador "El valor debe ser mayor o
// igual a <mañana>". Pasa igual si el cálculo ocurre en el servidor (en
// Hetzner, también UTC) o en el navegador del huésped (toISOString() SIEMPRE
// convierte a UTC sin importar la zona horaria de quien lo ejecuta).
//
// La fórmula correcta: pedirle a Intl.DateTimeFormat la fecha ya formateada
// en la zona horaria de México, en vez de pedir la fecha en UTC y asumir
// que coincide con el día local.
export function todayInMexicoStr(): string {
  // El locale "en-CA" formatea como YYYY-MM-DD de forma nativa, por eso se
  // usa aquí en vez de "es-MX" (que da DD/MM/YYYY y habría que reordenar).
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
}
