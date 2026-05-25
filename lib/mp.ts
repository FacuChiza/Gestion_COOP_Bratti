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
    reason: `Cooperadora Escolar Bratti - ${params.planNombre}`,
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
      console.error('[MP preapproval] error:', { status: res.status, body, response: data })
      return { ok: false, error: `MercadoPago rechazó la suscripción: ${msg}` }
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
  pagadorEmail: string
  referencia: string       // suscripcion_id o cuota_id
  tipo: 'anual' | 'manual' | 'pagador'
  /**
   * URL base a la que MP debe volver. Si no se pasa, va al dashboard.
   * Útil para el flujo express donde queremos volver a /aporte/[id].
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

  const body = {
    items: [{
      title: `Cooperadora Escolar - ${params.titulo}`,
      quantity: 1,
      unit_price: params.monto,
      currency_id: 'ARS',
    }],
    payer: { email: params.pagadorEmail },
    external_reference: `${params.tipo}:${params.referencia}`,
    back_urls: {
      success: `${baseRet}?pago=ok`,
      failure: `${baseRet}?pago=error`,
      pending: `${baseRet}?pago=pendiente`,
    },
    auto_return: 'approved',
    notification_url: `${appUrl}/api/webhooks/mp`,
  }

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
      return { ok: false, error: `MercadoPago rechazó el pago: ${msg}` }
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

// ── Validar webhook de MP ─────────────────────────────────────────────────────

export function validarWebhookMP(
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string | null,
  secret: string
): boolean {
  if (!xSignature || !xRequestId || !dataId) return false
  // Validación de firma HMAC-SHA256 de MP
  // Se activa cuando se configure el webhook secret en el dashboard de MP
  return true // TODO: implementar verificación HMAC cuando esté en producción
}
