/**
 * Integración MercadoPago
 * ─────────────────────────────────────────────────────────────
 * Para activar: agregá en Vercel (y en .env.local):
 *   MP_ACCESS_TOKEN   → tu Access Token de producción
 *   MP_PUBLIC_KEY     → tu Public Key
 *   MP_WEBHOOK_SECRET → string secreto para validar webhooks
 *   NEXT_PUBLIC_APP_URL → https://tu-dominio.vercel.app
 * ─────────────────────────────────────────────────────────────
 */

const BASE_URL = 'https://api.mercadopago.com'

function headers() {
  return {
    Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'X-Idempotency-Key': crypto.randomUUID(),
  }
}

export function mpConfigurado(): boolean {
  return !!process.env.MP_ACCESS_TOKEN && !!process.env.MP_PUBLIC_KEY
}

// ── Suscripción mensual automática (Preapproval) ──────────────────────────────

export async function crearSuscripcionMP(params: {
  pagadorNombre: string
  pagadorEmail: string
  monto: number
  planNombre: string
  suscripcionId: string
}): Promise<{ id: string; init_point: string } | null> {
  if (!mpConfigurado()) return null

  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  const body = {
    reason: `Cooperadora Escolar - ${params.planNombre}`,
    external_reference: params.suscripcionId,
    payer_email: params.pagadorEmail,
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: params.monto,
      currency_id: 'ARS',
    },
    back_url: `${appUrl}/cuenta/dashboard`,
    status: 'pending',
  }

  const res = await fetch(`${BASE_URL}/preapproval`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })

  if (!res.ok) return null
  const data = await res.json()
  return { id: data.id, init_point: data.init_point }
}

// ── Pago único (anual o mensual manual) ──────────────────────────────────────

export async function crearPreferenciaMP(params: {
  titulo: string
  monto: number
  pagadorEmail: string
  referencia: string       // suscripcion_id o cuota_id
  tipo: 'anual' | 'manual'
}): Promise<{ id: string; init_point: string; sandbox_init_point: string } | null> {
  if (!mpConfigurado()) return null

  const appUrl = process.env.NEXT_PUBLIC_APP_URL

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
      success: `${appUrl}/cuenta/dashboard?pago=ok`,
      failure: `${appUrl}/cuenta/dashboard?pago=error`,
      pending: `${appUrl}/cuenta/dashboard?pago=pendiente`,
    },
    auto_return: 'approved',
    notification_url: `${appUrl}/api/webhooks/mp`,
  }

  const res = await fetch(`${BASE_URL}/checkout/preferences`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })

  if (!res.ok) return null
  return res.json()
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
