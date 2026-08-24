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
  // El número en DB se guarda como E.164 (+549XXXXXXXXXX) desde el alta.
  // Si por algún caso legacy viene sin código, asumimos celular argentino
  // y prefijamos +549 (celulares en AR requieren el 9 después del 54).
  const limpio = para.replace(/\D/g, '')
  const conPrefijo = para.startsWith('+') ? para : `+549${limpio}`
  const to = `whatsapp:${conPrefijo}`

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

const $ = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`
const FIRMA = 'Cooperadora Escolar · E.T. N° 34 Bratti'

// Recibo de aporte recibido (efectivo, transferencia o MP)
export async function wspConfirmacionPago(params: {
  telefono: string
  nombrePagador: string
  nombreAlumno: string
  mes: string
  monto: number
}) {
  const msg =
    `✅ *Aporte recibido*\n\n` +
    `¡Hola ${params.nombrePagador}! Registramos tu aporte de *${params.mes}* ` +
    `para *${params.nombreAlumno}* por *${$(params.monto)}*.\n\n` +
    `¡Gracias por colaborar! 💚\n\n` +
    `_${FIRMA}_`
  return enviarWhatsApp(params.telefono, msg)
}

// Aviso de cobro del débito automático mensual
export async function wspDebitoAutomatico(params: {
  telefono: string
  nombrePagador: string
  nombreAlumno: string
  mes: string
  monto: number
}) {
  const msg =
    `💳 *Aporte automático procesado*\n\n` +
    `¡Hola ${params.nombrePagador}! Se realizó el aporte de *${params.mes}* ` +
    `para *${params.nombreAlumno}* por *${$(params.monto)}*.\n\n` +
    `No tenés que hacer nada. ¡Gracias! 💚\n\n` +
    `_${FIRMA}_`
  return enviarWhatsApp(params.telefono, msg)
}

// Recordatorio suave (con link directo para pagar de un toque)
export async function wspRecordatorioMensual(params: {
  telefono: string
  nombrePagador: string
  nombreAlumno: string
  mes: string
  monto: number
  link?: string
}) {
  const msg =
    `📅 *Recordatorio de aporte*\n\n` +
    `¡Hola ${params.nombrePagador}! El aporte de *${params.mes}* para ` +
    `*${params.nombreAlumno}* es de *${$(params.monto)}*.\n\n` +
    (params.link ? `Colaborá en un toque acá:\n${params.link}\n\n` : '') +
    `También podés acercarte a la cooperadora. ¡Gracias! 💚\n\n` +
    `_${FIRMA}_`
  return enviarWhatsApp(params.telefono, msg)
}

// Alerta de morosidad (con link directo para regularizar)
export async function wspAlertaDeuda(params: {
  telefono: string
  nombrePagador: string
  nombreAlumno: string
  mesesDeuda: number
  montoTotal: number
  link?: string
}) {
  const msg =
    `⚠️ *Aportes pendientes*\n\n` +
    `Hola ${params.nombrePagador}. *${params.nombreAlumno}* tiene ` +
    `*${params.mesesDeuda} aportes* sin realizar (total: *${$(params.montoTotal)}*).\n\n` +
    (params.link ? `Regularizá acá:\n${params.link}\n\n` : '') +
    `Si ya lo hiciste, ignorá este mensaje. Cualquier duda, acercate a la cooperadora.\n\n` +
    `_${FIRMA}_`
  return enviarWhatsApp(params.telefono, msg)
}
