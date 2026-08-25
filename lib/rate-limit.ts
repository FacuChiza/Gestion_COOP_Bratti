import { headers } from 'next/headers'

/**
 * Limitador de uso por IP para las acciones públicas de /pagar.
 *
 * Qué evita:
 *  • Que alguien recorra DNIs uno por uno para juntar nombres y cursos
 *    de los alumnos (scraping del padrón).
 *  • Que se generen cientos de preferencias de pago o suscripciones basura
 *    contra MercadoPago.
 *
 * Cómo funciona: ventana deslizante en memoria del servidor.
 *
 * LIMITACIÓN CONOCIDA: en Vercel cada instancia serverless tiene su propia
 * memoria, así que el conteo no es global ni sobrevive a un reinicio. Frena
 * el abuso casual y los scripts simples (que es el riesgo real acá), pero no
 * un ataque distribuido. Si algún día hiciera falta algo más fuerte, habría
 * que llevar el contador a la base de datos o a un servicio tipo Upstash.
 */

type Registro = { conteo: number; expira: number }

const memoria = new Map<string, Registro>()
const MAX_CLAVES = 5000 // tope para que el Map no crezca sin control

function limpiarSiHaceFalta(ahora: number) {
  if (memoria.size < MAX_CLAVES) return
  for (const [k, v] of memoria) {
    if (v.expira <= ahora) memoria.delete(k)
  }
  // Si aún está lleno (todo vigente), vaciamos: preferimos perder el conteo
  // antes que consumir memoria sin límite.
  if (memoria.size >= MAX_CLAVES) memoria.clear()
}

/** IP del visitante según los headers que agrega Vercel. */
export async function ipDelVisitante(): Promise<string> {
  const h = await headers()
  const fwd = h.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return h.get('x-real-ip') ?? 'desconocida'
}

/**
 * Consume un intento. Devuelve `true` si está permitido.
 *
 * @param accion  nombre de la acción (para contar cada una por separado)
 * @param limite  cantidad máxima de intentos permitidos en la ventana
 * @param ventanaSeg  duración de la ventana, en segundos
 */
export async function permitido(
  accion: string,
  limite: number,
  ventanaSeg: number,
): Promise<boolean> {
  const ip = await ipDelVisitante()
  const ahora = Date.now()
  const clave = `${accion}:${ip}`

  limpiarSiHaceFalta(ahora)

  const actual = memoria.get(clave)
  if (!actual || actual.expira <= ahora) {
    memoria.set(clave, { conteo: 1, expira: ahora + ventanaSeg * 1000 })
    return true
  }
  if (actual.conteo >= limite) return false

  actual.conteo++
  return true
}

/** Mensaje uniforme cuando se supera el límite. */
export const MSG_LIMITE =
  'Hiciste muchos intentos seguidos. Esperá un minuto y probá de nuevo.'
