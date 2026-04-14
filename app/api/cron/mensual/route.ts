/**
 * Cron Job mensual
 * ─────────────────────────────────────────────────────────────
 * Configurar en vercel.json para que corra el día 1 de cada mes.
 * También se puede disparar manualmente desde /admin.
 *
 * Hace 3 cosas:
 *  1. Genera cuotas del mes actual para suscripciones activas
 *  2. Marca como vencidas las cuotas pendientes del mes anterior
 *  3. Envía WhatsApp de recordatorio a los que pagan manual
 *  4. Envía WhatsApp de alerta a los que tienen 3+ meses de deuda
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { wspRecordatorioMensual, wspAlertaDeuda } from '@/lib/twilio'

export const dynamic = 'force-dynamic'

// Vercel llama al cron con el header "Authorization: Bearer <CRON_SECRET>"
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
  const mesActual = ahora.getMonth() + 1
  const añoActual = ahora.getFullYear()
  const fechaMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1)
  const mesAnterior = fechaMesAnterior.getMonth() + 1
  const añoAnterior = fechaMesAnterior.getFullYear()

  let cuotasGeneradas = 0
  let cuotasVencidas  = 0
  let recordatoriosEnviados = 0
  let alertasEnviadas = 0

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

  // ── 2. Generar cuotas del mes para suscripciones activas ──────
  const { data: suscripciones } = await supabase
    .from('suscripciones')
    .select('*, planes(*), alumnos(*, pagadores(*))')
    .eq('estado', 'activa')

  const mesNombre = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(ahora)

  if (suscripciones) {
    for (const susc of suscripciones) {
      // Verificar que no exista ya la cuota del mes
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

      // ── 3. WhatsApp de recordatorio (solo pago manual) ──────
      if (susc.tipo_pago === 'manual') {
        const pagador = susc.alumnos?.pagadores
        const alumno  = susc.alumnos
        if (pagador?.telefono && alumno) {
          await wspRecordatorioMensual({
            telefono:      pagador.telefono,
            nombrePagador: pagador.nombre.split(' ')[0],
            nombreAlumno:  alumno.nombre,
            mes:           mesNombre,
            monto:         susc.planes?.precio_por_mes ?? 0,
          })
          recordatoriosEnviados++
        }
      }
    }
  }

  // ── 4. WhatsApp de alerta por 3+ meses de deuda ──────────────
  const { data: alumnos } = await supabase
    .from('alumnos')
    .select('*, pagadores(*)')
    .eq('activo', true)

  if (alumnos) {
    for (const alumno of alumnos) {
      const { data: cuotasDeuda } = await supabase
        .from('cuotas')
        .select('monto')
        .eq('alumno_id', alumno.id)
        .in('estado', ['pendiente', 'vencida'])

      const mesesDeuda = cuotasDeuda?.length ?? 0
      if (mesesDeuda >= 3 && alumno.pagadores?.telefono) {
        const montoTotal = cuotasDeuda?.reduce((acc: number, c: { monto: number }) => acc + c.monto, 0) ?? 0
        await wspAlertaDeuda({
          telefono:      alumno.pagadores.telefono,
          nombrePagador: alumno.pagadores.nombre.split(' ')[0],
          nombreAlumno:  alumno.nombre,
          mesesDeuda,
          montoTotal,
        })
        alertasEnviadas++
      }
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
