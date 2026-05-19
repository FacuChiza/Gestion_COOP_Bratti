/**
 * Sesión admin — cookie firmada con HMAC-SHA256.
 *
 * Por qué este approach:
 *   • No queremos HTTP Basic (popup feo del navegador).
 *   • No queremos JWT con librería extra (deps adicionales).
 *   • Sí queremos algo que corra en Edge runtime (middleware), así que
 *     usamos Web Crypto API que está en Node y Edge.
 *
 * Cómo funciona:
 *   • Al loguearse correctamente, el server setea la cookie `admin_session`
 *     con el valor = HMAC-SHA256("admin-session-v1") usando ADMIN_PASSWORD
 *     como secret. Solo quien conoce el password puede generar ese token.
 *   • En cada request, el middleware recalcula el HMAC y compara. Si
 *     coincide, deja pasar; sino, redirige a /admin/login (o 401 si es API).
 *
 * Limitaciones (aceptables para una cooperadora):
 *   • Si rotás ADMIN_PASSWORD, todas las sesiones expiran. Bien.
 *   • No hay revocación individual: para forzar logout de todos, rotar
 *     el password.
 */

export const ADMIN_COOKIE = 'admin_session'
const PAYLOAD = 'admin-session-v1'

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function generarAdminToken(): Promise<string> {
  const secret = process.env.ADMIN_PASSWORD
  if (!secret) throw new Error('ADMIN_PASSWORD no configurada en el server.')
  return hmacHex(secret, PAYLOAD)
}

export async function esAdminTokenValido(token: string | undefined): Promise<boolean> {
  if (!token) return false
  try {
    const expected = await generarAdminToken()
    // Comparación constant-time básica
    if (token.length !== expected.length) return false
    let mismatch = 0
    for (let i = 0; i < token.length; i++) {
      mismatch |= token.charCodeAt(i) ^ expected.charCodeAt(i)
    }
    return mismatch === 0
  } catch {
    return false
  }
}

/**
 * Verifica usuario y contraseña contra las env vars.
 * Devuelve true si match. NO genera la cookie — eso lo hace el caller.
 */
export function verificarCredencialesAdmin(user: string, password: string): boolean {
  const expectedUser = process.env.ADMIN_USER ?? 'admin'
  const expectedPassword = process.env.ADMIN_PASSWORD ?? ''
  if (!expectedPassword) return false
  return user === expectedUser && password === expectedPassword
}
