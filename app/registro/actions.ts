'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { crearSuscripcionMP, crearPreferenciaMP, mpConfigurado } from '@/lib/mp'
import { emailBienvenida } from '@/lib/email'

export type RegistroResult =
  | { ok: true; pagadorId: string; tipoPago: string; mpUrl?: string }
  | { ok: false; error: string }

/**
 * Registra un pagador + alumno + suscripción desde la web pública.
 *
 * Decisión de diseño importante:
 *   NO creamos el user en `auth.users` acá. Solo creamos el pagador en
 *   `public.pagadores`. El user en auth.users se crea automáticamente
 *   en el primer magic link que pida desde /cuenta.
 *
 *   Esto evita un bug recurrente de admin.auth.admin.createUser que
 *   devuelve 500 ("unexpected_failure") en algunos proyectos de
 *   Supabase, y simplifica el flujo: el padre nunca necesita una
 *   contraseña, así que no tiene sentido crearle un user con password
 *   random.
 */
export async function registrarPagadorPublico(
  formData: FormData,
): Promise<RegistroResult> {
  try {
    return await registrarPagadorPublicoImpl(formData)
  } catch (err) {
    console.error('[registrarPagadorPublico] excepción no manejada:', err)
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return { ok: false, error: `Hubo un problema al registrarte: ${msg}. Si persiste, contactá a la cooperadora.` }
  }
}

async function registrarPagadorPublicoImpl(formData: FormData): Promise<RegistroResult> {
  const supabase = await createClient()
  const admin    = createAdminClient()

  // ── Datos del pagador ──────────────────────────────────────
  const nombre    = (formData.get('nombre')   as string).trim()
  const dniRaw    = (formData.get('dni')      as string ?? '').trim()
  const dni       = dniRaw.replace(/\D/g, '')
  const email     = (formData.get('email')    as string).trim().toLowerCase()

  // El input PhoneInput entrega solo dígitos (10 nros: área + número).
  // Lo normalizamos a E.164 con prefijo de móvil argentino: +549 + 10 dígitos.
  const telefonoDigitos = (formData.get('telefono') as string ?? '').replace(/\D/g, '')
  const telefono = telefonoDigitos.length === 10 ? `+549${telefonoDigitos}` : ''

  // ── Datos del alumno ───────────────────────────────────────
  const nombreAlumno = (formData.get('nombre_alumno') as string).trim()
  const grado        = formData.get('grado')           as string
  const turno        = formData.get('turno')           as string
  const tipoPago     = formData.get('tipo_pago')       as string

  if (!nombre || !dni || !email || !nombreAlumno || !grado || !turno || !tipoPago) {
    return { ok: false, error: 'Completá todos los campos.' }
  }
  if (!telefono) {
    return { ok: false, error: 'El número de WhatsApp debe tener 10 dígitos (área + número).' }
  }
  if (dni.length < 6 || dni.length > 10) {
    return { ok: false, error: 'El DNI debe tener entre 6 y 10 dígitos.' }
  }
  if ((tipoPago === 'suscripcion' || tipoPago === 'anual') && !mpConfigurado()) {
    return {
      ok: false,
      error: 'El pago por MercadoPago no está habilitado. Elegí "Aporte mensual" (efectivo) y pasá por la cooperadora.',
    }
  }

  // ── Pre-validaciones de unicidad ───────────────────────────
  const { data: existenteMail } = await supabase
    .from('pagadores').select('id').eq('mail', email).maybeSingle()
  if (existenteMail) {
    return { ok: false, error: 'Ya existe una cuenta con ese email. Ingresá al portal desde /cuenta.' }
  }

  const { data: existenteDni } = await admin
    .from('pagadores').select('id').eq('dni', dni).maybeSingle()
  if (existenteDni) {
    return { ok: false, error: 'Ya existe una cuenta con ese DNI.' }
  }

  // ── Buscar plan ────────────────────────────────────────────
  const turnoNormalized = turno.toLowerCase() === 'noche' ? 'nocturno' : 'diurno'
  const tipoPlan = tipoPago === 'anual' ? 'anual' : 'mensual'

  const { data: plan } = await admin
    .from('planes')
    .select('id, nombre, monto_total, precio_por_mes')
    .eq('turno', turnoNormalized)
    .eq('tipo', tipoPlan)
    .maybeSingle()

  if (!plan) {
    return { ok: false, error: 'No se encontró un plan para tu turno. Contactá a la cooperadora.' }
  }

  // Helper de rollback (sin tocar auth.users, no lo creamos acá)
  const rollback = async (creado: { pagadorId?: string; alumnoId?: string; suscripcionId?: string }) => {
    try {
      if (creado.suscripcionId) await admin.from('suscripciones').delete().eq('id', creado.suscripcionId)
      if (creado.alumnoId)      await admin.from('alumnos').delete().eq('id', creado.alumnoId)
      if (creado.pagadorId)     await admin.from('pagadores').delete().eq('id', creado.pagadorId)
    } catch (e) {
      console.error('[registro] error durante rollback:', e)
    }
  }

  // ── Crear pagador ──────────────────────────────────────────
  const { data: pagador, error: errPagador } = await admin
    .from('pagadores')
    .insert({ nombre, dni, mail: email, telefono })
    .select()
    .single()

  if (errPagador || !pagador) {
    console.error('[registro] error creando pagador:', errPagador)
    return { ok: false, error: 'Error al guardar tus datos. Intentá de nuevo.' }
  }

  // ── Crear alumno ───────────────────────────────────────────
  const { data: alumno, error: errAlumno } = await admin
    .from('alumnos')
    .insert({ nombre: nombreAlumno, grado, turno, pagador_id: pagador.id, activo: true })
    .select()
    .single()

  if (errAlumno || !alumno) {
    console.error('[registro] error creando alumno:', errAlumno)
    await rollback({ pagadorId: pagador.id })
    return { ok: false, error: 'Error al registrar al alumno.' }
  }

  // ── Crear suscripción ──────────────────────────────────────
  const mpStatus = tipoPago === 'manual' ? 'activa' : 'pending'
  const { data: suscripcion, error: errSusc } = await admin
    .from('suscripciones')
    .insert({
      alumno_id:    alumno.id,
      plan_id:      plan.id,
      fecha_inicio: new Date().toISOString().split('T')[0],
      estado:       tipoPago === 'manual' ? 'activa' : 'pendiente',
      metodo_pago:  tipoPago === 'manual' ? 'efectivo' : 'mercadopago',
      tipo_pago:    tipoPago,
      mp_status:    mpStatus,
    })
    .select()
    .single()

  if (errSusc || !suscripcion) {
    console.error('[registro] error creando suscripción:', errSusc)
    await rollback({ pagadorId: pagador.id, alumnoId: alumno.id })
    return { ok: false, error: 'Error al crear la suscripción.' }
  }

  // ── Conectar con MercadoPago según tipo de pago ───────────
  if (tipoPago === 'suscripcion') {
    const mp = await crearSuscripcionMP({
      pagadorNombre: nombre,
      pagadorEmail:  email,
      monto:         plan.precio_por_mes,
      planNombre:    plan.nombre,
      suscripcionId: suscripcion.id,
    })

    if (!mp.ok) {
      await rollback({ pagadorId: pagador.id, alumnoId: alumno.id, suscripcionId: suscripcion.id })
      return { ok: false, error: mp.error }
    }

    await admin
      .from('suscripciones')
      .update({ mp_preapproval_id: mp.id })
      .eq('id', suscripcion.id)

    return { ok: true, pagadorId: pagador.id, tipoPago, mpUrl: mp.init_point }
  }

  if (tipoPago === 'anual') {
    const mp = await crearPreferenciaMP({
      titulo:       plan.nombre,
      monto:        plan.monto_total,
      pagadorEmail: email,
      referencia:   suscripcion.id,
      tipo:         'anual',
    })

    if (!mp.ok) {
      await rollback({ pagadorId: pagador.id, alumnoId: alumno.id, suscripcionId: suscripcion.id })
      return { ok: false, error: mp.error }
    }

    return { ok: true, pagadorId: pagador.id, tipoPago, mpUrl: mp.init_point }
  }

  // ── tipoPago === 'manual' ──────────────────────────────────
  // Mandar bienvenida por mail (best-effort, no bloquea).
  try {
    await emailBienvenida({ mail: email, nombrePagador: nombre, nombreAlumno })
  } catch (e) {
    console.error('[registro] emailBienvenida falló (no crítico):', e)
  }

  return { ok: true, pagadorId: pagador.id, tipoPago }
}
