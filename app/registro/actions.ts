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

  // El input PhoneInput entrega solo dígitos (10 nros: área + número).
  // Lo normalizamos al formato internacional E.164 con prefijo de móvil
  // argentino: +549 + 10 dígitos. Es lo que Twilio WhatsApp espera.
  const telefonoDigitos = (formData.get('telefono') as string ?? '').replace(/\D/g, '')
  const telefono = telefonoDigitos.length === 10 ? `+549${telefonoDigitos}` : ''

  // Password random — el padre nunca lo usa, el login es magic link.
  const password = `${crypto.randomUUID()}-${crypto.randomUUID()}`

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

  // Pre-check de auth.users: aunque truncamos pagadores, puede haber
  // quedado el user en Supabase Auth (TRUNCATE no toca auth.users).
  // Si lo encontramos, lo limpiamos antes de crearlo de nuevo para no
  // bloquear el registro.
  try {
    const { data: authList } = await admin.auth.admin.listUsers()
    const existenteAuth = authList?.users.find((u) => u.email?.toLowerCase() === email)
    if (existenteAuth) {
      // Lo borramos para que el INSERT siguiente no choque con duplicado.
      // Hacerlo silenciosamente porque es un estado huérfano que el padre
      // no entiende. Si el delete falla, igual seguimos y dejamos que
      // createUser tire el error específico.
      await admin.auth.admin.deleteUser(existenteAuth.id)
      console.warn(`[registro] limpiamos auth user huérfano para ${email}`)
    }
  } catch (e) {
    console.error('[registro] listUsers falló:', e)
    // no abortamos, dejamos que createUser intente igual
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

  if (authError || !authData?.user) {
    // Logueamos TODO el error para diagnosticar desde Vercel logs
    console.error('[registro] auth.admin.createUser falló:', {
      email,
      message: authError?.message,
      status: (authError as { status?: number })?.status,
      full: authError,
    })

    const rawMsg = (authError?.message ?? '').toLowerCase()

    if (rawMsg.includes('already') || rawMsg.includes('exist') || rawMsg.includes('registered')) {
      return { ok: false, error: 'Ya existe una cuenta con ese email. Ingresá desde el portal.' }
    }
    if (rawMsg.includes('invalid') && rawMsg.includes('email')) {
      return { ok: false, error: 'El formato del email no es válido.' }
    }
    if (rawMsg.includes('rate') || rawMsg.includes('429')) {
      return { ok: false, error: 'Hubo muchos intentos seguidos. Esperá un minuto y probá de nuevo.' }
    }
    if (rawMsg.includes('internal server error') || rawMsg.includes('database error')) {
      return {
        ok: false,
        error: 'Supabase Auth está devolviendo error 500. Probá con otro email, o avisá al admin que revise el dashboard de Supabase → Authentication → Users (puede haber un usuario huérfano con ese email).',
      }
    }

    return {
      ok: false,
      error: `No pudimos crear tu cuenta: ${authError?.message ?? 'error desconocido'}. Probá de nuevo o contactá a la cooperadora.`,
    }
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
