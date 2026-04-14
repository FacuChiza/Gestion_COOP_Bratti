/**
 * Integración Twilio WhatsApp
 * ─────────────────────────────────────────────────────────────
 * Para activar: agregá en Vercel (y en .env.local):
 *   TWILIO_ACCOUNT_SID    → tu Account SID de Twilio
 *   TWILIO_AUTH_TOKEN     → tu Auth Token de Twilio
 *   TWILIO_WHATSAPP_FROM  → whatsapp:+14155238886 (número Twilio)
 * ─────────────────────────────────────────────────────────────
 */

export function twilioConfigurado(): boolean {
  return (
    !!process.env.TWILIO_ACCOUNT_SID &&
    !!process.env.TWILIO_AUTH_TOKEN &&
    !!process.env.TWILIO_WHATSAPP_FROM
  )
}

async function enviarWhatsApp(para: string, mensaje: string): Promise<boolean> {
  if (!twilioConfigurado()) {
    console.log(`[WhatsApp simulado → ${para}]: ${mensaje}`)
    return false
  }

  const from = process.env.TWILIO_WHATSAPP_FROM!
  const to   = `whatsapp:${para.startsWith('+') ? para : `+54${para.replace(/\D/g, '')}`}`

  const url = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
      ).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: from, To: to, Body: mensaje }),
  })

  return res.ok
}

// ── Mensajes predefinidos ─────────────────────────────────────────────────────

export async function wspConfirmacionPago(params: {
  telefono: string
  nombrePagador: string
  nombreAlumno: string
  mes: string
  monto: number
}) {
  const msg =
    `✅ *Cooperadora Escolar*\n\n` +
    `Hola ${params.nombrePagador}! Se registró el pago de *${params.mes}* ` +
    `para *${params.nombreAlumno}* por *$${params.monto.toLocaleString('es-AR')}*. ` +
    `¡Gracias! 🙌`

  return enviarWhatsApp(params.telefono, msg)
}

export async function wspDebitoAutomatico(params: {
  telefono: string
  nombrePagador: string
  nombreAlumno: string
  mes: string
  monto: number
}) {
  const msg =
    `💳 *Cooperadora Escolar*\n\n` +
    `Hola ${params.nombrePagador}! Se debitó automáticamente la cuota de *${params.mes}* ` +
    `para *${params.nombreAlumno}* por *$${params.monto.toLocaleString('es-AR')}*.\n\n` +
    `Podés ver el detalle en tu portal: ${process.env.NEXT_PUBLIC_APP_URL}/cuenta`

  return enviarWhatsApp(params.telefono, msg)
}

export async function wspRecordatorioMensual(params: {
  telefono: string
  nombrePagador: string
  nombreAlumno: string
  mes: string
  monto: number
}) {
  const msg =
    `📅 *Cooperadora Escolar*\n\n` +
    `Hola ${params.nombrePagador}! Te recordamos que la cuota de *${params.mes}* ` +
    `para *${params.nombreAlumno}* es de *$${params.monto.toLocaleString('es-AR')}*.\n\n` +
    `Pagá fácil desde tu portal: ${process.env.NEXT_PUBLIC_APP_URL}/cuenta`

  return enviarWhatsApp(params.telefono, msg)
}

export async function wspAlertaDeuda(params: {
  telefono: string
  nombrePagador: string
  nombreAlumno: string
  mesesDeuda: number
  montoTotal: number
}) {
  const msg =
    `⚠️ *Cooperadora Escolar*\n\n` +
    `Hola ${params.nombrePagador}. *${params.nombreAlumno}* tiene ` +
    `*${params.mesesDeuda} meses* sin pagar (total: *$${params.montoTotal.toLocaleString('es-AR')}*).\n\n` +
    `Te pedimos que te acerques a regularizar la situación o pagá desde: ` +
    `${process.env.NEXT_PUBLIC_APP_URL}/cuenta`

  return enviarWhatsApp(params.telefono, msg)
}

export async function wspBienvenida(params: {
  telefono: string
  nombrePagador: string
  nombreAlumno: string
  portalUrl: string
}) {
  const msg =
    `👋 *Bienvenido/a a la Cooperadora Escolar!*\n\n` +
    `Hola ${params.nombrePagador}! Tu cuenta fue creada para el alumno *${params.nombreAlumno}*.\n\n` +
    `Accedé a tu portal en:\n${params.portalUrl}\n\n` +
    `Ahí vas a poder ver el estado de tus cuotas y pagar online.`

  return enviarWhatsApp(params.telefono, msg)
}
