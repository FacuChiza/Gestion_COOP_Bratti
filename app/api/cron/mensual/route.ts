/**
 * Cron mensual — corre el día 1 de cada mes a las 12 UTC (9 AM Argentina).
 * También se puede disparar manualmente desde /admin (CronButton).
 *
 * Responsabilidad ÚNICA: trabajo contable invisible.
 *  1. Marca como "vencidas" las cuotas pendientes del mes anterior.
 *  2. Genera la cuota del mes actual para cada alumno activo (modelo padrón).
 *
 * NO manda avisos. Los avisos los maneja el cron diario (/api/cron/diario).
 */

import { NextRequest, NextResponse } from 'next/server'
import { generarAportesMensuales } from '@/lib/cron-mensual'

export const dynamic = 'force-dynamic'

function autenticado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // sin secreto configurado, no se permite ejecutar
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  return token === secret
}

export async function GET(req: NextRequest) {
  if (!autenticado(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const resultado = await generarAportesMensuales()
  return NextResponse.json({ ok: true, ...resultado })
}
