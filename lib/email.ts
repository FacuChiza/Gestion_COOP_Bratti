/**
 * Servicio de emails — Resend
 * ─────────────────────────────────────────────────────────────
 * Para activar, agregá en Vercel (y en .env.local):
 *   RESEND_API_KEY  → tu API key de resend.com (gratis hasta 3000/mes)
 *   EMAIL_FROM      → "Cooperadora Escolar <noreply@tu-dominio.com>"
 *                     (sin dominio propio usá: "Cooperadora <onboarding@resend.dev>")
 *   NEXT_PUBLIC_APP_URL → https://tu-dominio.vercel.app (ya debería existir)
 * ─────────────────────────────────────────────────────────────
 */

export function emailConfigurado(): boolean {
  return !!process.env.RESEND_API_KEY
}

// ─── Envío base ───────────────────────────────────────────────────────────────

async function enviarEmail(params: {
  to: string
  subject: string
  html: string
}): Promise<boolean> {
  if (!emailConfigurado()) {
    console.log(`[Email simulado → ${params.to}]: ${params.subject}`)
    return false
  }

  const from =
    process.env.EMAIL_FROM ||
    'Cooperadora Escolar <onboarding@resend.dev>'

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: params.to, subject: params.subject, html: params.html }),
    })

    if (!res.ok) {
      const txt = await res.text()
      console.error('[email error]', txt)
      return false
    }
    return true
  } catch (err) {
    console.error('[email]', err)
    return false
  }
}

// ─── Helpers de formato ───────────────────────────────────────────────────────

function formatMonto(n: number) {
  return `$${n.toLocaleString('es-AR')}`
}

function fechaLarga(date: Date = new Date()) {
  return date.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ─── Layout base del email ────────────────────────────────────────────────────

function layoutEmail(contenido: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cooperadora Escolar</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
        <!-- Header -->
        <tr>
          <td style="background:#0f172a;padding:24px 32px">
            <table width="100%"><tr>
              <td>
                <div style="display:inline-block;background:rgba(255,255,255,.1);border-radius:8px;padding:8px;vertical-align:middle;margin-right:12px">
                  <span style="font-size:18px">🏫</span>
                </div>
                <span style="color:#fff;font-size:18px;font-weight:700;vertical-align:middle">Cooperadora Escolar</span>
              </td>
            </tr></table>
          </td>
        </tr>
        <!-- Contenido -->
        <tr><td style="padding:32px">${contenido}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center">
            <p style="margin:0;font-size:12px;color:#94a3b8">
              Escuela Aristides Bratti · Cooperadora Escolar<br>
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/cuenta" style="color:#64748b">Accedé a tu portal</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ─── Recibo de pago ───────────────────────────────────────────────────────────

export type CuotaRecibo = {
  mes: string   // "Abril 2026"
  monto: number
  estado?: string
}

export type ReciboParams = {
  mail:          string
  nombrePagador: string
  nombreAlumno:  string | string[]   // 1 alumno o varios
  cuotas:        CuotaRecibo[]
  montoTotal:    number
  metodoPago:    'mercadopago' | 'efectivo'
  nroRecibo?:    string
}

export async function enviarRecibo(params: ReciboParams): Promise<boolean> {
  const nro    = params.nroRecibo ?? `${Date.now()}`
  const fecha  = fechaLarga()
  const metodo = params.metodoPago === 'mercadopago' ? 'MercadoPago' : 'Efectivo'
  const alumnos = Array.isArray(params.nombreAlumno)
    ? params.nombreAlumno.join(', ')
    : params.nombreAlumno

  const filasCuotas = params.cuotas.map(c => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#334155">${c.mes}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#334155;text-align:right;font-weight:600">${formatMonto(c.monto)}</td>
    </tr>`).join('')

  const contenido = `
    <!-- Badge confirmación -->
    <div style="text-align:center;margin-bottom:24px">
      <div style="display:inline-block;background:#dcfce7;border-radius:50px;padding:10px 20px">
        <span style="color:#166534;font-weight:700;font-size:15px">✅ Pago confirmado</span>
      </div>
    </div>

    <h2 style="margin:0 0 4px;font-size:20px;color:#0f172a">Recibo de pago</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b">Nº ${nro} · ${fecha}</p>

    <!-- Info pagador y alumno -->
    <table width="100%" style="background:#f8fafc;border-radius:10px;margin-bottom:20px">
      <tr>
        <td style="padding:14px 16px">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">Pagador/a</p>
          <p style="margin:4px 0 0;font-weight:600;color:#1e293b">${params.nombrePagador}</p>
        </td>
        <td style="padding:14px 16px;border-left:1px solid #e2e8f0">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em">Estudiante/s</p>
          <p style="margin:4px 0 0;font-weight:600;color:#1e293b">${alumnos}</p>
        </td>
      </tr>
    </table>

    <!-- Cuotas pagadas -->
    <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Cuotas abonadas</p>
    <table width="100%" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:16px;border-collapse:collapse">
      <thead>
        <tr style="background:#f8fafc">
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600">Período</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;color:#64748b;font-weight:600">Monto</th>
        </tr>
      </thead>
      <tbody>${filasCuotas}</tbody>
    </table>

    <!-- Total -->
    <table width="100%" style="background:#0f172a;border-radius:10px;margin-bottom:24px">
      <tr>
        <td style="padding:14px 20px;color:#94a3b8;font-size:14px">Total abonado</td>
        <td style="padding:14px 20px;text-align:right;color:#fff;font-size:20px;font-weight:700">${formatMonto(params.montoTotal)}</td>
      </tr>
    </table>

    <!-- Método y nota -->
    <table width="100%" style="margin-bottom:8px">
      <tr>
        <td style="font-size:13px;color:#64748b">Método de pago</td>
        <td style="text-align:right;font-size:13px;color:#334155;font-weight:600">${metodo}</td>
      </tr>
    </table>

    <p style="margin:20px 0 0;padding:12px;background:#f0fdf4;border-radius:8px;font-size:12px;color:#166534;text-align:center">
      Este comprobante es válido como recibo de pago de la Cooperadora Escolar Aristides Bratti.
    </p>`

  return enviarEmail({
    to:      params.mail,
    subject: `✅ Recibo de pago — ${alumnos} · ${fechaLarga()}`,
    html:    layoutEmail(contenido),
  })
}

// ─── Recordatorio mensual ─────────────────────────────────────────────────────

export async function emailRecordatorioMensual(params: {
  mail:          string
  nombrePagador: string
  nombreAlumno:  string
  mes:           string
  monto:         number
}): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  const contenido = `
    <h2 style="margin:0 0 8px;color:#0f172a">Recordatorio de cuota 📅</h2>
    <p style="margin:0 0 20px;color:#64748b;font-size:15px">
      Hola <strong>${params.nombrePagador}</strong>,
    </p>
    <p style="color:#334155;font-size:15px;line-height:1.6">
      Te recordamos que la cuota de <strong>${params.mes}</strong> para <strong>${params.nombreAlumno}</strong>
      está disponible para pagar.
    </p>

    <table width="100%" style="background:#f8fafc;border-radius:10px;margin:20px 0">
      <tr>
        <td style="padding:16px 20px">
          <p style="margin:0;font-size:13px;color:#94a3b8">Monto</p>
          <p style="margin:4px 0 0;font-size:22px;font-weight:700;color:#0f172a">${formatMonto(params.monto)}</p>
        </td>
        <td style="padding:16px 20px;border-left:1px solid #e2e8f0">
          <p style="margin:0;font-size:13px;color:#94a3b8">Período</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:600;color:#0f172a">${params.mes}</p>
        </td>
      </tr>
    </table>

    <div style="text-align:center;margin:24px 0">
      <a href="${appUrl}/cuenta" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px">
        Pagar ahora →
      </a>
    </div>

    <p style="font-size:13px;color:#94a3b8;text-align:center;margin:0">
      También podés acercarte a la cooperadora para pagar en efectivo.
    </p>`

  return enviarEmail({
    to:      params.mail,
    subject: `Recordatorio: cuota ${params.mes} — ${params.nombreAlumno}`,
    html:    layoutEmail(contenido),
  })
}

// ─── Alerta de deuda ──────────────────────────────────────────────────────────

export async function emailAlertaDeuda(params: {
  mail:          string
  nombrePagador: string
  nombreAlumno:  string
  mesesDeuda:    number
  montoTotal:    number
}): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  const contenido = `
    <h2 style="margin:0 0 8px;color:#0f172a">Cuotas pendientes ⚠️</h2>
    <p style="margin:0 0 20px;color:#64748b;font-size:15px">
      Hola <strong>${params.nombrePagador}</strong>,
    </p>

    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px 20px;margin-bottom:20px">
      <p style="margin:0;font-size:15px;color:#991b1b;line-height:1.6">
        <strong>${params.nombreAlumno}</strong> tiene <strong>${params.mesesDeuda} cuotas</strong> sin pagar
        por un total de <strong>${formatMonto(params.montoTotal)}</strong>.
      </p>
    </div>

    <p style="color:#334155;font-size:14px;line-height:1.6">
      Te pedimos que regularices la situación a la brevedad. Podés pagar online desde
      el portal o acercarte personalmente a la cooperadora.
    </p>

    <div style="text-align:center;margin:24px 0">
      <a href="${appUrl}/cuenta" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px">
        Regularizar deuda →
      </a>
    </div>`

  return enviarEmail({
    to:      params.mail,
    subject: `⚠️ ${params.mesesDeuda} cuotas pendientes — ${params.nombreAlumno}`,
    html:    layoutEmail(contenido),
  })
}

// ─── Bienvenida ───────────────────────────────────────────────────────────────

export async function emailBienvenida(params: {
  mail:          string
  nombrePagador: string
  nombreAlumno:  string
}): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  const contenido = `
    <h2 style="margin:0 0 8px;color:#0f172a">¡Bienvenido/a a la Cooperadora! 👋</h2>
    <p style="margin:0 0 20px;color:#64748b;font-size:15px">
      Hola <strong>${params.nombrePagador}</strong>,
    </p>
    <p style="color:#334155;font-size:15px;line-height:1.6">
      Tu cuenta fue creada exitosamente para el/la estudiante <strong>${params.nombreAlumno}</strong>.
      Desde tu portal podés ver el estado de las cuotas y pagar online de forma fácil y segura.
    </p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;margin:20px 0">
      <p style="margin:0;font-size:14px;color:#166534">
        📧 Tu usuario es: <strong>${params.mail}</strong><br>
        🔑 Podés cambiar tu contraseña desde el portal en cualquier momento.
      </p>
    </div>

    <div style="text-align:center;margin:24px 0">
      <a href="${appUrl}/cuenta" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px">
        Ir a mi portal →
      </a>
    </div>`

  return enviarEmail({
    to:      params.mail,
    subject: `¡Bienvenido/a a la Cooperadora Escolar!`,
    html:    layoutEmail(contenido),
  })
}
