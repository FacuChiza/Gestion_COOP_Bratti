'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { crearPreferenciaMP, crearSuscripcionMP } from '@/lib/mp'
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

/**
 * Activa el débito automático mensual para un alumno.
 * Necesita el email (MP lo exige para la suscripción). El WhatsApp es
 * opcional pero recomendado para los avisos. Crea/vincula el pagador,
 * crea la suscripción en estado pendiente y devuelve el link de MP donde
 * el padre carga la tarjeta. La suscripción se activa vía webhook.
 */
export async function crearDebitoAlumno(
  alumnoId: string,
  emailRaw: string,
  telefonoRaw?: string,
): Promise<{ initPoint?: string; error?: string }> {
  const email = (emailRaw ?? '').trim().toLowerCase()
  if (!email || !email.includes('@')) return { error: 'Ingresá un email válido.' }

  const admin = createAdminClient()
  const { data: alumno } = await admin
    .from('alumnos')
    .select('id, nombre, pagador_id, activo')
    .eq('id', alumnoId)
    .maybeSingle()
  if (!alumno || alumno.activo === false) return { error: 'Alumno no encontrado.' }

  const telDigits = (telefonoRaw ?? '').replace(/\D/g, '')
  const telE164 = telDigits.length === 10 ? `+549${telDigits}` : null
  const nombrePagador = email.split('@')[0]

  // 1. Resolver / crear el pagador por email
  let pagadorId: string | null = alumno.pagador_id
  const { data: existente } = await admin
    .from('pagadores').select('id').eq('mail', email).maybeSingle()
  if (existente) {
    pagadorId = existente.id
    if (telE164) await admin.from('pagadores').update({ telefono: telE164 }).eq('id', existente.id)
  } else {
    const { data: nuevo } = await admin
      .from('pagadores')
      .insert({ nombre: nombrePagador, mail: email, telefono: telE164 })
      .select('id').single()
    if (nuevo) pagadorId = nuevo.id
  }
  if (!pagadorId) return { error: 'No se pudo registrar el pagador.' }
  if (alumno.pagador_id !== pagadorId) {
    await admin.from('alumnos').update({ pagador_id: pagadorId }).eq('id', alumnoId)
  }

  // 2. Monto con descuento por hermanos
  const cfg = await getPreciosConfig()
  const cantidad = await cantidadFamiliaActiva(pagadorId)
  const monto = montoMensual(cfg, cantidad)

  // 3. Plan mensual (para el FK de la suscripción)
  const { data: plan } = await admin
    .from('planes').select('id').eq('tipo', 'mensual').limit(1).maybeSingle()
  if (!plan) return { error: 'No hay un plan mensual configurado. Avisá a la cooperadora.' }

  // 4. Cancelar débitos previos del alumno para no duplicar
  await admin
    .from('suscripciones')
    .update({ estado: 'cancelada' })
    .eq('alumno_id', alumnoId)
    .eq('tipo_pago', 'suscripcion')
    .in('estado', ['activa', 'pendiente'])

  // 5. Crear la suscripción pendiente
  const { data: susc } = await admin
    .from('suscripciones')
    .insert({
      alumno_id: alumnoId,
      plan_id: plan.id,
      fecha_inicio: new Date().toISOString().split('T')[0],
      estado: 'pendiente',
      metodo_pago: 'mercadopago',
      tipo_pago: 'suscripcion',
      mp_status: 'pending',
    })
    .select('id').single()
  if (!susc) return { error: 'No se pudo crear la suscripción.' }

  // 6. Preapproval en MP
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const mp = await crearSuscripcionMP({
    pagadorNombre: nombrePagador,
    pagadorEmail: email,
    monto,
    planNombre: `Aporte mensual — ${alumno.nombre}`,
    suscripcionId: susc.id,
    backUrl: `${appUrl}/pagar?pago=ok`,
  })

  if (!mp.ok) {
    await admin.from('suscripciones').delete().eq('id', susc.id)
    return { error: mp.error }
  }

  await admin.from('suscripciones').update({ mp_preapproval_id: mp.id }).eq('id', susc.id)
  return { initPoint: mp.init_point }
}
