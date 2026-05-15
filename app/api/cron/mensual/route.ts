/**
 * Cron Job mensual — corre el día 1 de cada mes a las 9:00 AM
 * También se puede disparar manualmente desde /admin.
 *
 * Política de notificaciones (anti-spam):
 *  • NO enviamos recordatorio mensual (ni WhatsApp ni email).
 *    El padre ve el estado en su dashboard / link público.
 *  • Solo enviamos UNA alerta por WhatsApp cuando se cruza el umbral
 *    de 4 aportes pendientes (es decir, justo cuando llega a 4).
 *    Así evitamos repetir la alerta mes a mes.
 *
 * Hace 3 cosas:
 *  1. Marca como vencidas las cuotas pendientes del mes anterior
 *  2. Genera cuotas del mes actual para suscripciones activas
 *  3. Envía UNA alerta WhatsApp a los que recién cruzan 4 aportes pendientes
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { wspAlertaDeuda } from '@/lib/twilio'

export const dynamic = 'force-dynamic'

// Umbral por defecto si la fila no existe en configuracion
const UMBRAL_ALERTA_FALLBACK = 4

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
  let alertasEnviadas = 0

  // ── Leer umbral de alerta desde configuracion ────────────────
  const { data: configRow } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('clave', 'meses_alerta_deuda')
    .maybeSingle()

  const umbralAlerta = configRow?.valor
    ? Number(configRow.valor) || UMBRAL_ALERTA_FALLBACK
    : UMBRAL_ALERTA_FALLBACK

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

  // ── 2. Generar cuotas del mes actual (sin recordatorios) ────
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
    }
  }

  // ── 3. Alerta única al cruzar el umbral de 4 aportes pendientes ─
  // Solo disparamos cuando el contador es EXACTAMENTE el umbral, no antes
  // ni después: así no repetimos la alerta mes a mes ni saturamos al pagador.
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
      if (mesesDeuda !== umbralAlerta) continue

      const pagador = alumno.pagadores as unknown as { nombre: string; telefono: string; mail: string } | null
      if (!pagador) continue

      const montoTotal = cuotasDeuda?.reduce((acc: number, c: { monto: number }) => acc + c.monto, 0) ?? 0

      if (pagador.telefono) {
        await wspAlertaDeuda({
          telefono:      pagador.telefono,
          nombrePagador: pagador.nombre.split(' ')[0],
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
    alertasEnviadas,
    umbralAlerta,
  })
}
