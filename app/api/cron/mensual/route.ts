/**
 * Cron mensual — corre el día 1 de cada mes a las 12 UTC (9 AM Argentina).
 * También se puede disparar manualmente desde /admin (CronButton).
 *
 * Responsabilidad ÚNICA: trabajo contable invisible.
 *  1. Marca como "vencidas" las cuotas pendientes del mes anterior.
 *  2. Genera las cuotas del mes actual para suscripciones activas.
 *
 * NO manda avisos. Los avisos personalizados los maneja el cron diario
 * (ver /api/cron/diario), que respeta el ritmo de pago de cada pagador.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

  // ── 2. Generar cuotas del mes actual ──────────────────────────
  const { data: suscripciones } = await supabase
    .from('suscripciones')
    .select('*, planes(*)')
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

  return NextResponse.json({
    ok: true,
    cuotasGeneradas,
    cuotasVencidas,
  })
}
