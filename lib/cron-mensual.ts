import { createAdminClient } from '@/lib/supabase/admin'
import { getPreciosConfig, montoMensual } from '@/lib/precios'

/**
 * Generación mensual de aportes — modelo padrón.
 *
 * A diferencia del modelo viejo (una cuota por suscripción), acá generamos
 * una cuota mensual para CADA ALUMNO ACTIVO, con el monto que le corresponde
 * (contemplando el descuento por hermanos). Así el dashboard puede mostrar
 * correctamente quién debe, aunque el alumno todavía no haya pagado nunca.
 *
 * Reglas:
 *  1. Las cuotas pendientes del mes anterior pasan a "vencida".
 *  2. Se genera la cuota del mes actual para cada alumno activo, salvo que:
 *     - ya exista una cuota de ese mes (idempotente), o
 *     - el alumno tenga una suscripción anual activa de este ciclo (ya pagó
 *       el año completo).
 *
 * Es seguro correrla varias veces: no duplica cuotas.
 */
export async function generarAportesMensuales(): Promise<{
  cuotasGeneradas: number
  cuotasVencidas: number
  alumnosActivos: number
}> {
  const supabase = createAdminClient()
  const ahora = new Date()
  const mesActual = ahora.getMonth() + 1
  const anioActual = ahora.getFullYear()
  const fechaAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1)
  const mesAnterior = fechaAnterior.getMonth() + 1
  const anioAnterior = fechaAnterior.getFullYear()

  // ── 1. Vencer las pendientes del mes anterior ────────────────
  const { count: aVencer } = await supabase
    .from('cuotas')
    .select('*', { count: 'exact', head: true })
    .eq('mes', mesAnterior)
    .eq('año', anioAnterior)
    .eq('estado', 'pendiente')

  const cuotasVencidas = aVencer ?? 0
  if (cuotasVencidas > 0) {
    await supabase
      .from('cuotas')
      .update({ estado: 'vencida' })
      .eq('mes', mesAnterior)
      .eq('año', anioAnterior)
      .eq('estado', 'pendiente')
  }

  // ── 2. Alumnos activos ───────────────────────────────────────
  const { data: alumnos } = await supabase
    .from('alumnos')
    .select('id, pagador_id')
    .eq('activo', true)

  if (!alumnos || alumnos.length === 0) {
    return { cuotasGeneradas: 0, cuotasVencidas, alumnosActivos: 0 }
  }
  const alumnoIds = alumnos.map((a) => a.id)

  // Tamaño de familia por pagador (para descuento hermanos)
  const familia = new Map<string, number>()
  for (const a of alumnos) {
    if (a.pagador_id) familia.set(a.pagador_id, (familia.get(a.pagador_id) ?? 0) + 1)
  }

  // Alumnos con aporte anual activo de ESTE ciclo → se saltean
  const { data: anuales } = await supabase
    .from('suscripciones')
    .select('alumno_id, fecha_inicio')
    .eq('tipo_pago', 'anual')
    .eq('estado', 'activa')
    .in('alumno_id', alumnoIds)
  const skipAnual = new Set(
    (anuales ?? [])
      .filter((s) => new Date(s.fecha_inicio).getFullYear() === anioActual)
      .map((s) => s.alumno_id),
  )

  // Cuotas del mes actual que ya existen → se saltean
  const { data: existentes } = await supabase
    .from('cuotas')
    .select('alumno_id')
    .eq('mes', mesActual)
    .eq('año', anioActual)
    .in('alumno_id', alumnoIds)
  const yaTiene = new Set((existentes ?? []).map((c) => c.alumno_id))

  // ── 3. Armar e insertar las cuotas nuevas ────────────────────
  const cfg = await getPreciosConfig()
  const nuevas = alumnos
    .filter((a) => !yaTiene.has(a.id) && !skipAnual.has(a.id))
    .map((a) => {
      const cant = a.pagador_id ? (familia.get(a.pagador_id) ?? 1) : 1
      return {
        alumno_id: a.id,
        mes: mesActual,
        año: anioActual,
        monto: montoMensual(cfg, cant),
        estado: 'pendiente',
      }
    })

  let cuotasGeneradas = 0
  if (nuevas.length > 0) {
    const { error } = await supabase.from('cuotas').insert(nuevas)
    if (!error) cuotasGeneradas = nuevas.length
    else console.error('[generarAportesMensuales] insert:', error)
  }

  return { cuotasGeneradas, cuotasVencidas, alumnosActivos: alumnos.length }
}
