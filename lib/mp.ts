/**
 * Integración MercadoPago
 * ─────────────────────────────────────────────────────────────
 * Para activar: agregá en Vercel (y en .env.local):
 *   MP_ACCESS_TOKEN   → tu Access Token de producción
 *   MP_PUBLIC_KEY     → tu Public Key
 *   MP_WEBHOOK_SECRET → string secreto para validar webhooks
 *   NEXT_PUBLIC_APP_URL → https://tu-dominio.vercel.app
 * ─────────────────────────────────────────────────────────────
 *
 * Todos los wrappers de MP devuelven un objeto con `ok` booleano para que
 * el caller pueda saber si fue exitoso y mostrar el error específico.
 * Antes devolvían `null` en error y eso hacía imposible diagnosticar.
 */

const BASE_URL = 'https://api.mercadopago.com'

/**
 * MP no permite tener Checkout Pro + Suscripciones en la misma app, así que
 * usamos 2 access tokens:
 *   • MP_ACCESS_TOKEN              → app de Checkout Pro (pagos únicos:
 *                                    aporte mensual manual y aporte anual)
 *   • MP_SUBSCRIPTION_ACCESS_TOKEN → app de Suscripciones (débito automático)
 *
 * Si MP_SUBSCRIPTION_ACCESS_TOKEN no está definido, caemos al
 * MP_ACCESS_TOKEN (útil cuando solo hay una app configurada).
 */
function headers(modo: 'checkout' | 'suscripcion' = 'checkout') {
  const token =
    modo === 'suscripcion'
      ? process.env.MP_SUBSCRIPTION_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN
      : process.env.MP_ACCESS_TOKEN

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Idempotency-Key': crypto.randomUUID(),
  }
}

/**
 * Traduce los errores frecuentes de MercadoPago a un mensaje que un
 * aportante pueda entender y accionar. Si no reconocemos el error,
 * devolvemos uno genérico (el detalle técnico queda en los logs).
 */
function mensajeAmigableMP(msgRaw: string): string {
  const m = (msgRaw ?? '').toLowerCase()

  if (m.includes('payer and collector') || m.includes('cannot be the same')) {
    return 'No podés aportar con la misma cuenta de Mercado Pago que recibe los aportes. Usá otro email o pagá con tarjeta desde otra cuenta.'
  }
  if (m.includes('invalid') && m.includes('email')) {
    return 'El email no es válido. Revisalo e intentá de nuevo.'
  }
  if (m.includes('invalid users involved') || m.includes('invalid user')) {
    return 'Mercado Pago no aceptó esa cuenta para esta operación. Probá con otro email.'
  }
  if (m.includes('60 characters') || m.includes('reason')) {
    return 'Hubo un problema al preparar la suscripción. Avisale a la cooperadora.'
  }
  if (m.includes('unauthorized') || m.includes('invalid_token') || m.includes('access')) {
    return 'El sistema de pagos no está bien configurado. Avisale a la cooperadora.'
  }
  return 'Mercado Pago no pudo procesar la operación en este momento. Probá de nuevo en unos minutos.'
}

export function mpConfigurado(): boolean {
  return !!process.env.MP_ACCESS_TOKEN && !!process.env.MP_PUBLIC_KEY
}

export function mpSuscripcionesHabilitado(): boolean {
  return !!process.env.MP_SUBSCRIPTION_ACCESS_TOKEN
}

// ── Tipos de retorno ──────────────────────────────────────────────────────────

export type MpPreapprovalResult =
  | { ok: true;  id: string; init_point: string }
  | { ok: false; error: string }

export type MpPreferenceResult =
  | { ok: true;  id: string; init_point: string; sandbox_init_point: string }
  | { ok: false; error: string }

// ── Suscripción mensual automática (Preapproval) ──────────────────────────────

export async function crearSuscripcionMP(params: {
  pagadorNombre: string
  pagadorEmail: string
  monto: number
  planNombre: string
  suscripcionId: string
  /** URL a la que MP redirige después de cargar la tarjeta. */
  backUrl?: string
}): Promise<MpPreapprovalResult> {
  if (!mpConfigurado()) {
    return { ok: false, error: 'MercadoPago no está configurado en el servidor.' }
  }
  if (!mpSuscripcionesHabilitado()) {
    return {
      ok: false,
      error: 'El débito automático todavía no está habilitado. Elegí "Aporte mensual" o "Aporte anual" mientras tanto.',
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    return { ok: false, error: 'NEXT_PUBLIC_APP_URL no está configurada.' }
  }

  // back_url debe ser pública (sin login requerido) y HTTPS válida.
  // Usamos /aporte/[pagadorId] como destino seguro, sino el dashboard
  // de la cooperadora como fallback.
  const backUrl = params.backUrl ?? `${appUrl}/cuenta`

  // IMPORTANTE: NO incluir `status: 'pending'`. Si se omite, MP responde
  // con un init_point para que el pagador autorice la suscripción cargando
  // su tarjeta. Si se pasa status:pending sin card_token_id, MP devuelve
  // 500 "Internal server error" (es la causa principal de fallas en este
  // endpoint según la doc oficial).
  const body = {
    // MP limita `reason` a 60 caracteres. Usamos uno corto y fijo; el
    // detalle (alumno) queda en external_reference y en la suscripción.
    reason: 'Aporte mensual - Cooperadora Bratti',
    external_reference: params.suscripcionId,
    payer_email: params.pagadorEmail,
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: params.monto,
      currency_id: 'ARS',
    },
    back_url: backUrl,
  }

  try {
    const res = await fetch(`${BASE_URL}/preapproval`, {
      method: 'POST',
      headers: headers('suscripcion'),
      body: JSON.stringify(body),
    })

    const raw = await res.text()
    let data: { id?: string; init_point?: string; message?: string; error?: string; cause?: unknown }
    try {
      data = JSON.parse(raw)
    } catch {
      console.error('[MP preapproval] respuesta no-JSON:', raw)
      return { ok: false, error: `MP devolvió una respuesta inesperada (HTTP ${res.status}).` }
    }

    if (!res.ok || !data.id || !data.init_point) {
      const msg = data.message || data.error || `HTTP ${res.status}`
      const tokenUsado =
        process.env.MP_SUBSCRIPTION_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || ''
      console.error('[MP preapproval] error:', {
        status: res.status,
        body,
        response: data,
        // hint para diagnosticar: 4 últimos chars del token + si veníamos del fallback
        tokenTail: tokenUsado.slice(-6),
        tokenSource: process.env.MP_SUBSCRIPTION_ACCESS_TOKEN ? 'MP_SUBSCRIPTION_ACCESS_TOKEN' : 'MP_ACCESS_TOKEN (fallback)',
      })
      return { ok: false, error: mensajeAmigableMP(msg) }
    }

    return { ok: true, id: data.id, init_point: data.init_point }
  } catch (err) {
    console.error('[MP preapproval] excepción:', err)
    return { ok: false, error: 'No se pudo conectar con MercadoPago. Intentá de nuevo en unos minutos.' }
  }
}

// ── Pago único (anual o mensual manual) ──────────────────────────────────────

export async function crearPreferenciaMP(params: {
  titulo: string
  monto: number
  /** Opcional: si no se pasa, el pagador ingresa su email en el checkout de MP. */
  pagadorEmail?: string
  referencia: string       // suscripcion_id, pagador_id o alumno_id según tipo
  // am = aporte mensual · aa = aporte anual · av = aporte de monto libre
  tipo: 'anual' | 'manual' | 'pagador' | 'am' | 'aa' | 'av'
  /**
   * URL base a la que MP debe volver. Si no se pasa, va al dashboard.
   */
  backUrlBase?: string
}): Promise<MpPreferenceResult> {
  if (!mpConfigurado()) {
    return { ok: false, error: 'MercadoPago no está configurado en el servidor.' }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    return { ok: false, error: 'NEXT_PUBLIC_APP_URL no está configurada.' }
  }

  const baseRet = params.backUrlBase ?? `${appUrl}/cuenta/dashboard`

  const body: Record<string, unknown> = {
    items: [{
      title: `Cooperadora Escolar - ${params.titulo}`,
      quantity: 1,
      unit_price: params.monto,
      currency_id: 'ARS',
    }],
    external_reference: `${params.tipo}:${params.referencia}`,
    back_urls: {
      success: `${baseRet}?pago=ok`,
      failure: `${baseRet}?pago=error`,
      pending: `${baseRet}?pago=pendiente`,
    },
    auto_return: 'approved',
    notification_url: `${appUrl}/api/webhooks/mp`,
  }
  // El email es opcional: si no lo tenemos (padrón sin pagador), el padre
  // lo ingresa directamente en el checkout de MercadoPago.
  if (params.pagadorEmail) body.payer = { email: params.pagadorEmail }

  try {
    const res = await fetch(`${BASE_URL}/checkout/preferences`, {
      method: 'POST',
      headers: headers('checkout'),
      body: JSON.stringify(body),
    })

    const raw = await res.text()
    let data: { id?: string; init_point?: string; sandbox_init_point?: string; message?: string; error?: string }
    try {
      data = JSON.parse(raw)
    } catch {
      console.error('[MP preference] respuesta no-JSON:', raw)
      return { ok: false, error: `MP devolvió una respuesta inesperada (HTTP ${res.status}).` }
    }

    if (!res.ok || !data.id || !data.init_point) {
      const msg = data.message || data.error || `HTTP ${res.status}`
      console.error('[MP preference] error:', { status: res.status, body, response: data })
      return { ok: false, error: mensajeAmigableMP(msg) }
    }

    return {
      ok: true,
      id: data.id,
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point ?? data.init_point,
    }
  } catch (err) {
    console.error('[MP preference] excepción:', err)
    return { ok: false, error: 'No se pudo conectar con MercadoPago. Intentá de nuevo en unos minutos.' }
  }
}

// ── Cancelar suscripción / débito automático ─────────────────────────────────

export async function cancelarSuscripcionMP(preapprovalId: string): Promise<boolean> {
  if (!preapprovalId) return false
  const token = process.env.MP_SUBSCRIPTION_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN
  try {
    const res = await fetch(`${BASE_URL}/preapproval/${preapprovalId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    if (!res.ok) console.error('[cancelarSuscripcionMP]', preapprovalId, res.status)
    return res.ok
  } catch (err) {
    console.error('[cancelarSuscripcionMP] excepción:', err)
    return false
  }
}

// ── Validar webhook de MP ─────────────────────────────────────────────────────

/**
 * Verifica que la notificación venga realmente de MercadoPago.
 *
 * MP firma cada webhook con HMAC-SHA256 sobre el manifest:
 *     id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 * y lo envía en el header `x-signature` como `ts=...,v1=<hash>`.
 *
 * Devuelve:
 *   'ok'          → firma válida
 *   'sin-secreto' → no hay MP_WEBHOOK_SECRET configurado (no podemos validar)
 *   'invalida'    → la firma no coincide o faltan headers
 */
export async function validarWebhookMP(
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string | null,
): Promise<'ok' | 'sin-secreto' | 'invalida'> {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) return 'sin-secreto'
  if (!xSignature || !dataId) return 'invalida'

  // x-signature: "ts=1704908010,v1=618c8534..."
  const partes = Object.fromEntries(
    xSignature.split(',').map((p) => {
      const [k, ...v] = p.trim().split('=')
      return [k.trim(), v.join('=').trim()]
    }),
  ) as { ts?: string; v1?: string }

  if (!partes.ts || !partes.v1) return 'invalida'

  // MP normaliza el id a minúsculas cuando es alfanumérico
  const idNorm = String(dataId).toLowerCase()
  const manifest = `id:${idNorm};request-id:${xRequestId ?? ''};ts:${partes.ts};`

  try {
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(manifest))
    const calculado = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    // Comparación en tiempo constante
    if (calculado.length !== partes.v1.length) return 'invalida'
    let diff = 0
    for (let i = 0; i < calculado.length; i++) {
      diff |= calculado.charCodeAt(i) ^ partes.v1.charCodeAt(i)
    }
    return diff === 0 ? 'ok' : 'invalida'
  } catch (err) {
    console.error('[MP webhook] error validando firma:', err)
    return 'invalida'
  }
}
