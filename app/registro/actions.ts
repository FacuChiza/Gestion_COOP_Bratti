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
 * Estrategia de rollback:
 *  Si algo falla a mitad del proceso, deshacemos las inserciones previas
 *  para que el padre pueda volver a intentar sin chocar contra "ya existe
 *  ese email/DNI". El orden de rollback es inverso al de creación.
 */
export async function registrarPagadorPublico(
  formData: FormData,
): Promise<RegistroResult> {
  try {
    return await registrarPagadorPublicoImpl(formData)
  } catch (err) {
    // Captura cualquier excepción no manejada para no devolver 500 al cliente.
    console.error('[registrarPagadorPublico] excepción no manejada:', err)
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return { ok: false, error: `Hubo un problema al registrarte: ${msg}. Si persiste, contactá a la cooperadora.` }
  }
}

async function registrarPagadorPublicoImpl(formData: FormData): Promise<RegistroResult> {
  const supabase = await createClient()
  const admin   = createAdminClient()

  // ── Datos del pagador ──────────────────────────────────────
  const nombre    = (formData.get('nombre')   as string).trim()
  const dniRaw    = (formData.get('dni')      as string ?? '').trim()
  const dni       = dniRaw.replace(/\D/g, '')
  const email     = (formData.get('email')    as string).trim().toLowerCase()
  const telefono  = (formData.get('telefono') as string).trim()

  // Password random — el padre nunca lo usa, el login es magic link.
  const password = `${crypto.randomUUID()}-${crypto.randomUUID()}`

  // ── Datos del alumno ───────────────────────────────────────
  const nombreAlumno = (formData.get('nombre_alumno') as string).trim()
  const grado        = formData.get('grado')           as string
  const turno        = formData.get('turno')           as string
  const tipoPago     = formData.get('tipo_pago')       as string

  if (!nombre || !dni || !email || !telefono || !nombreAlumno || !grado || !turno || !tipoPago) {
    return { ok: false, error: 'Completá todos los campos.' }
  }
  if (dni.length < 6 || dni.length > 10) {
    return { ok: false, error: 'El DNI debe tener entre 6 y 10 dígitos.' }
  }
  if ((tipoPago === 'suscripcion' || tipoPago === 'anual') && !mpConfigurado()) {
    return {
      ok: false,
      error: 'El pago por MercadoPago no está habilitado en este momento. Elegí "Aporte mensual" (en efectivo) y pasá por la cooperadora.',
    }
  }

  // ── Pre-validaciones de unicidad ───────────────────────────
  const { data: existenteMail } = await supabase
    .from('pagadores').select('id').eq('mail', email).maybeSingle()
  if (existenteMail) {
    return { ok: false, error: 'Ya existe una cuenta con ese email. Podés ingresar desde el portal.' }
  }

  const { data: existenteDni } = await admin
    .from('pagadores').select('id').eq('dni', dni).maybeSingle()
  if (existenteDni) {
    return { ok: false, error: 'Ya existe una cuenta con ese DNI. Si sos vos, ingresá desde el portal.' }
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

  // ── Crear usuario en Supabase Auth ─────────────────────────
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) {
    const msg = authError.message.toLowerCase()
    if (msg.includes('already') || msg.includes('exist') || msg.includes('registered')) {
      return { ok: false, error: 'Ya existe una cuenta con ese email. Podés ingresar desde el portal.' }
    }
    return { ok: false, error: `Error al crear tu cuenta: ${authError.message}` }
  }

  const authUserId = authData.user.id

  // Helper: deshace todo lo creado hasta acá, en orden inverso.
  const rollback = async (creado: { authUserId?: string; pagadorId?: string; alumnoId?: string; suscripcionId?: string }) => {
    try {
      if (creado.suscripcionId) {
        await admin.from('suscripciones').delete().eq('id', creado.suscripcionId)
      }
      if (creado.alumnoId) {
        await admin.from('alumnos').delete().eq('id', creado.alumnoId)
      }
      if (creado.pagadorId) {
        await admin.from('pagadores').delete().eq('id', creado.pagadorId)
      }
      if (creado.authUserId) {
        await admin.auth.admin.deleteUser(creado.authUserId)
      }
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
    await rollback({ authUserId })
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
    await rollback({ authUserId, pagadorId: pagador.id })
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
    await rollback({ authUserId, pagadorId: pagador.id, alumnoId: alumno.id })
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
      // Rollback total: borramos todo lo que creamos para que pueda
      // reintentar sin chocar con duplicados.
      await rollback({ authUserId, pagadorId: pagador.id, alumnoId: alumno.id, suscripcionId: suscripcion.id })
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
      await rollback({ authUserId, pagadorId: pagador.id, alumnoId: alumno.id, suscripcionId: suscripcion.id })
      return { ok: false, error: mp.error }
    }

    return { ok: true, pagadorId: pagador.id, tipoPago, mpUrl: mp.init_point }
  }

  // ── tipoPago === 'manual' ──────────────────────────────────
  // Bienvenida solo por email para no saturar.
  await emailBienvenida({
    mail:          email,
    nombrePagador: nombre,
    nombreAlumno:  nombreAlumno,
  })

  return { ok: true, pagadorId: pagador.id, tipoPago }
}
