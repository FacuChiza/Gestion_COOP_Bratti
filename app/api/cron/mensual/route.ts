/**
 * Cron Job mensual — corre el día 1 de cada mes a las 9:00 AM
 * También se puede disparar manualmente desde /admin.
 *
 * Hace 4 cosas:
 *  1. Marca como vencidas las cuotas pendientes del mes anterior
 *  2. Genera cuotas del mes actual para suscripciones activas
 *  3. Envía WhatsApp + email de recordatorio a los que pagan manual
 *  4. Envía WhatsApp + email de alerta a los que tienen 3+ meses de deuda
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { wspRecordatorioMensual, wspAlertaDeuda } from '@/lib/twilio'
import { emailRecordatorioMensual, emailAlertaDeuda } from '@/lib/email'
import { formatMes } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function autenticado(req: NextRequest): boolean {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  return token === process.env.CRON_SECRET
}

export async function GET(req: NextRequest) {
  if (!autenticado(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const ahora = new Date()
  const mesActual  = ahora.getMonth() + 1
  const añoActual  = ahora.getFullYear()
  const fechaMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1)
  const mesAnterior = fechaMesAnterior.getMonth() + 1
  const añoAnterior = fechaMesAnterior.getFullYear()

  let cuotasGeneradas = 0
  let cuotasVencidas  = 0
  let recordatoriosEnviados = 0
  let alertasEnviadas = 0

  const mesNombre = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(ahora)

  // ── 1. Marcar vencidas las pendientes del mes anterior ────────
  const { count } = await supabase
    .from('cuotas')
    .select('*', { count: 'exact', head: true })
    .eq('mes', mesAnterior)
    .eq('año', añoAnterior)
    .eq('estado', 'pendiente')

  cuotasVencidas = count ?? 0

  await supabase
    .from('cuotas')
    .update({ estado: 'vencida' })
    .eq('mes', mesAnterior)
    .eq('año', añoAnterior)
    .eq('estado', 'pendiente')

  // ── 2. Generar cuotas + enviar recordatorios (pago manual) ────
  const { data: suscripciones } = await supabase
    .from('suscripciones')
    .select('*, planes(*), alumnos(*, pagadores(*))')
    .eq('estado', 'activa')

  if (suscripciones) {
    for (const susc of suscripciones) {
      const { data: existente } = await supabase
        .from('cuotas')
        .select('id')
        .eq('alumno_id', susc.alumno_id)
        .eq('mes', mesActual)
        .eq('año', añoActual)
        .maybeSingle()

      if (!existente && susc.planes) {
        await supabase.from('cuotas').insert({
          alumno_id:      susc.alumno_id,
          suscripcion_id: susc.id,
          mes:            mesActual,
          año:            añoActual,
          monto:          susc.planes.precio_por_mes,
          estado:         'pendiente',
        })
        cuotasGeneradas++
      }

      // Solo pago manual recibe recordatorio (suscripción → MP les cobra solo)
      if (susc.tipo_pago === 'manual') {
        const pagador = susc.alumnos?.pagadores
        const alumno  = susc.alumnos
        if (!pagador || !alumno) continue

        const monto = susc.planes?.precio_por_mes ?? 0

        // WhatsApp
        if (pagador.telefono) {
          await wspRecordatorioMensual({
            telefono:      pagador.telefono,
            nombrePagador: pagador.nombre.split(' ')[0],
            nombreAlumno:  alumno.nombre,
            mes:           mesNombre,
            monto,
          })
        }

        // Email
        if (pagador.mail) {
          await emailRecordatorioMensual({
            mail:          pagador.mail,
            nombrePagador: pagador.nombre,
            nombreAlumno:  alumno.nombre,
            mes:           mesNombre,
            monto,
          })
        }

        recordatoriosEnviados++
      }
    }
  }

  // ── 3. Alertas por 3+ meses de deuda ─────────────────────────
  const { data: alumnos } = await supabase
    .from('alumnos')
    .select('id, nombre, pagadores(nombre, telefono, mail)')
    .eq('activo', true)

  if (alumnos) {
    for (const alumno of alumnos) {
      const { data: cuotasDeuda } = await supabase
        .from('cuotas')
        .select('monto')
        .eq('alumno_id', alumno.id)
        .in('estado', ['pendiente', 'vencida'])

      const mesesDeuda = cuotasDeuda?.length ?? 0
      if (mesesDeuda < 3) continue

      const pagador    = alumno.pagadores as unknown as { nombre: string; telefono: string; mail: string } | null
      if (!pagador)  continue

      const montoTotal = cuotasDeuda?.reduce((acc: number, c: { monto: number }) => acc + c.monto, 0) ?? 0

      // WhatsApp
      if (pagador.telefono) {
        await wspAlertaDeuda({
          telefono:      pagador.telefono,
          nombrePagador: pagador.nombre.split(' ')[0],
          nombreAlumno:  alumno.nombre,
          mesesDeuda,
          montoTotal,
        })
      }

      // Email
      if (pagador.mail) {
        await emailAlertaDeuda({
          mail:          pagador.mail,
          nombrePagador: pagador.nombre,
          nombreAlumno:  alumno.nombre,
          mesesDeuda,
          montoTotal,
        })
      }

      alertasEnviadas++
    }
  }

  return NextResponse.json({
    ok: true,
    cuotasGeneradas,
    cuotasVencidas,
    recordatoriosEnviados,
    alertasEnviadas,
  })
}
