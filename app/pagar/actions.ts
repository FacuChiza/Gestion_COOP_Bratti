'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { crearPreferenciaMP, crearSuscripcionMP } from '@/lib/mp'
import { getPreciosConfig, montoMensual, cantidadFamiliaActiva } from '@/lib/precios'

export type DatosTransferencia = {
  alias: string
  cbu: string
  titular: string
  banco: string
  habilitado: boolean
}

/** Datos de la cuenta de la cooperadora para transferencia directa (sin MP). */
export async function getDatosTransferencia(): Promise<DatosTransferencia> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('configuracion')
    .select('clave, valor')
    .in('clave', ['transferencia_alias', 'transferencia_cbu', 'transferencia_titular', 'transferencia_banco'])
  const m = new Map((data ?? []).map((r) => [r.clave, (r.valor ?? '').trim()]))
  const alias = m.get('transferencia_alias') ?? ''
  const cbu   = m.get('transferencia_cbu') ?? ''
  return {
    alias,
    cbu,
    titular: m.get('transferencia_titular') ?? '',
    banco:   m.get('transferencia_banco') ?? '',
    habilitado: !!(alias || cbu),
  }
}

export type Sugerencia = { id: string; nombre: string; grado: string; turno: string | null }

/**
 * Sugerencias en vivo mientras el aportante escribe (tipo buscador de Google).
 * Consulta liviana: solo los campos que se muestran, máximo 6 resultados.
 */
export async function sugerirAlumnos(term: string): Promise<Sugerencia[]> {
  const t = (term ?? '').trim()
  if (t.length < 2) return []

  const admin = createAdminClient()
  const soloDigitos = t.replace(/\D/g, '')
  const esDni = soloDigitos.length >= 3 && soloDigitos === t.replace(/[\s.]/g, '')

  let q = admin
    .from('alumnos')
    .select('id, nombre, grado, turno')
    .eq('activo', true)
    .order('nombre')
    .limit(6)

  q = esDni ? q.like('dni', `${soloDigitos}%`) : q.ilike('nombre', `%${t}%`)

  const { data, error } = await q
  if (error) { console.error('[sugerirAlumnos]', error); return [] }
  return (data ?? []) as Sugerencia[]
}

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

/** Trae un alumno listo para aportar a partir de su id (al elegir una sugerencia). */
export async function getAlumnoParaAportePorId(
  alumnoId: string,
): Promise<{ alumno?: AlumnoParaAporte; error?: string }> {
  const admin = createAdminClient()
  const { data: a } = await admin
    .from('alumnos')
    .select('id, nombre, grado, turno, pagador_id, activo')
    .eq('id', alumnoId)
    .maybeSingle()

  if (!a || a.activo === false) return { error: 'No encontramos al alumno.' }

  const cfg = await getPreciosConfig()
  const cantidadFamilia = await cantidadFamiliaActiva(a.pagador_id)
  return {
    alumno: {
      id: a.id,
      nombre: a.nombre,
      grado: a.grado,
      turno: a.turno,
      montoMensual: montoMensual(cfg, cantidadFamilia),
      montoAnual: cfg.anual,
      esFamilia: cantidadFamilia >= 2,
      cantidadFamilia,
    },
  }
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
 * Aporte voluntario de MONTO LIBRE: el aportante colabora con lo que puede.
 * Se registra como aporte recibido; si el monto alcanza a cubrir el aporte
 * del mes, esa cuota queda saldada (lo resuelve el webhook, tipo 'av').
 */
export async function crearPagoLibreAlumno(
  alumnoId: string,
  montoRaw: number,
): Promise<{ initPoint?: string; error?: string }> {
  const monto = Math.round(Number(montoRaw))
  if (!monto || isNaN(monto) || monto < 100) {
    return { error: 'El monto mínimo es $100.' }
  }
  if (monto > 2000000) {
    return { error: 'El monto es demasiado alto. Verificá el valor.' }
  }

  const admin = createAdminClient()
  const { data: alumno } = await admin
    .from('alumnos')
    .select('id, nombre, activo')
    .eq('id', alumnoId)
    .maybeSingle()
  if (!alumno || alumno.activo === false) return { error: 'Alumno no encontrado.' }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const mp = await crearPreferenciaMP({
    titulo: `Aporte voluntario — ${alumno.nombre}`,
    monto,
    referencia: alumno.id,
    tipo: 'av',
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
