'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { crearPreferenciaMP } from '@/lib/mp'
import { getPreciosConfig, montoMensual, cantidadFamiliaActiva } from '@/lib/precios'

export type AlumnoParaAporte = {
  id: string
  nombre: string
  grado: string
  turno: string | null
  montoMensual: number
  montoAnual: number
  esFamilia: boolean
  cantidadFamilia: number
}

/**
 * Busca alumnos activos por DNI (exacto) o por nombre (parcial).
 * Devuelve el/los alumno/s listos para pagar, con el monto ya calculado
 * (contemplando el descuento por hermanos).
 */
export async function buscarAlumnoParaAporte(
  term: string,
): Promise<{ alumnos?: AlumnoParaAporte[]; error?: string }> {
  const t = (term ?? '').trim()
  if (t.length < 3) return { error: 'Escribí el DNI o el nombre del alumno.' }

  const admin = createAdminClient()
  const soloDigitos = t.replace(/\D/g, '')
  const esDni = soloDigitos.length >= 6 && soloDigitos === t.replace(/\s/g, '')

  let query = admin
    .from('alumnos')
    .select('id, nombre, grado, turno, pagador_id')
    .eq('activo', true)
    .order('nombre')
    .limit(10)

  query = esDni ? query.eq('dni', soloDigitos) : query.ilike('nombre', `%${t}%`)

  const { data, error } = await query
  if (error) {
    console.error('[buscarAlumnoParaAporte]', error)
    return { error: 'Hubo un problema al buscar. Probá de nuevo.' }
  }
  if (!data || data.length === 0) {
    return {
      error: esDni
        ? 'No encontramos ningún alumno con ese DNI. Si se anotó hace poco o no figura, acercate a la cooperadora.'
        : 'No encontramos alumnos con ese nombre. Probá con el DNI, o acercate a la cooperadora.',
    }
  }

  const cfg = await getPreciosConfig()
  const alumnos: AlumnoParaAporte[] = []
  for (const a of data) {
    const cantidadFamilia = await cantidadFamiliaActiva(a.pagador_id)
    alumnos.push({
      id: a.id,
      nombre: a.nombre,
      grado: a.grado,
      turno: a.turno,
      montoMensual: montoMensual(cfg, cantidadFamilia),
      montoAnual: cfg.anual,
      esFamilia: cantidadFamilia >= 2,
      cantidadFamilia,
    })
  }
  return { alumnos }
}

/**
 * Crea la preferencia de MercadoPago para el aporte mensual de un alumno.
 * El pago se registra cuando MP confirma vía webhook (tipo 'am').
 */
export async function crearPagoMensualAlumno(
  alumnoId: string,
): Promise<{ initPoint?: string; error?: string }> {
  const admin = createAdminClient()
  const { data: alumno } = await admin
    .from('alumnos')
    .select('id, nombre, pagador_id, activo')
    .eq('id', alumnoId)
    .maybeSingle()

  if (!alumno || alumno.activo === false) return { error: 'Alumno no encontrado.' }

  const cfg = await getPreciosConfig()
  const cantidadFamilia = await cantidadFamiliaActiva(alumno.pagador_id)
  const monto = montoMensual(cfg, cantidadFamilia)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const mes = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(new Date())

  const mp = await crearPreferenciaMP({
    titulo: `Aporte ${mes} — ${alumno.nombre}`,
    monto,
    referencia: alumno.id,
    tipo: 'am',
    backUrlBase: `${appUrl}/pagar`,
  })

  if (!mp.ok) return { error: mp.error }
  return { initPoint: mp.init_point }
}

/**
 * Crea la preferencia de MercadoPago para el aporte ANUAL de un alumno
 * (pago único que cubre el ciclo lectivo). Se registra vía webhook (tipo 'aa').
 */
export async function crearPagoAnualAlumno(
  alumnoId: string,
): Promise<{ initPoint?: string; error?: string }> {
  const admin = createAdminClient()
  const { data: alumno } = await admin
    .from('alumnos')
    .select('id, nombre, activo')
    .eq('id', alumnoId)
    .maybeSingle()

  if (!alumno || alumno.activo === false) return { error: 'Alumno no encontrado.' }

  const cfg = await getPreciosConfig()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const anio = new Date().getFullYear()

  const mp = await crearPreferenciaMP({
    titulo: `Aporte anual ${anio} — ${alumno.nombre}`,
    monto: cfg.anual,
    referencia: alumno.id,
    tipo: 'aa',
    backUrlBase: `${appUrl}/pagar`,
  })

  if (!mp.ok) return { error: mp.error }
  return { initPoint: mp.init_point }
}
