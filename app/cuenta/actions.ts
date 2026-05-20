'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function loginAction(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Email o contraseña incorrectos' }
  }

  redirect('/cuenta/dashboard')
}

/**
 * Login con código OTP de 6 dígitos por email.
 *
 * Por qué código y no magic link:
 *   Algunos clientes de mail (Gmail entre otros) hacen "preview prefetch"
 *   de los links al recibir el mensaje, lo que consume el magic link
 *   antes de que el usuario lo abra. Resultado: cuando el padre clickea,
 *   el link ya está usado y figura como expirado. Con código de 6 dígitos
 *   no hay link que se pueda consumir por accidente.
 *
 *   Bonus: es el patrón que usan WhatsApp Web, Slack, los bancos, etc.,
 *   así que es familiar para cualquier padre.
 *
 * Seguridad: solo dejamos enviar el código a emails que ya están como
 * pagadores en public.pagadores. El user en auth.users se crea
 * automáticamente al verificar el OTP (shouldCreateUser: true).
 */
export async function pedirCodigoAction(formData: FormData) {
  const supabase = await createClient()
  const email = (formData.get('email') as string ?? '').trim().toLowerCase()
  if (!email) return { error: 'Ingresá tu email' }

  const admin = createAdminClient()
  const { data: pagador } = await admin
    .from('pagadores')
    .select('id')
    .eq('mail', email)
    .maybeSingle()

  if (!pagador) {
    return { error: 'No encontramos una cuenta con ese email. Si te registraste hace poco, esperá unos minutos y probá de nuevo.' }
  }

  // Sin emailRedirectTo → Supabase manda CÓDIGO de 6 dígitos (no magic link)
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  })

  if (error) {
    console.error('[pedirCodigo]', error)
    if (error.message?.toLowerCase().includes('rate')) {
      return { error: 'Hubo muchos intentos seguidos. Esperá un minuto.' }
    }
    return { error: 'No se pudo enviar el código. Probá de nuevo en unos minutos.' }
  }

  return { ok: true, email }
}

export async function verificarCodigoAction(formData: FormData) {
  const supabase = await createClient()
  const email = (formData.get('email') as string ?? '').trim().toLowerCase()
  const token = (formData.get('token') as string ?? '').replace(/\D/g, '').trim()

  if (!email || !token) return { error: 'Faltan datos.' }
  if (token.length !== 6) return { error: 'El código debe tener 6 dígitos.' }

  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })

  if (error) {
    console.error('[verificarCodigo]', error)
    const msg = error.message?.toLowerCase() ?? ''
    if (msg.includes('expired') || msg.includes('invalid')) {
      return { error: 'El código es incorrecto o expiró. Pedí uno nuevo.' }
    }
    return { error: 'No pudimos validar el código. Probá de nuevo.' }
  }

  return { ok: true }
}

export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/cuenta')
}

export async function getDashboardData() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Buscar pagador por email
  const { data: pagador } = await supabase
    .from('pagadores')
    .select('*')
    .eq('mail', user.email!)
    .maybeSingle()

  if (!pagador) return { pagador: null, alumnos: [] }

  // Alumnos del pagador con suscripciones y cuotas
  const { data: alumnos } = await supabase
    .from('alumnos')
    .select('*, suscripciones(*, planes(*))')
    .eq('pagador_id', pagador.id)
    .eq('activo', true)
    .order('nombre')

  if (!alumnos) return { pagador, alumnos: [] }

  const ahora = new Date()
  const mesActual = ahora.getMonth() + 1
  const añoActual = ahora.getFullYear()

  // Para cada alumno, traer cuotas
  const alumnosConCuotas = await Promise.all(
    alumnos.map(async (alumno) => {
      const { data: cuotas } = await supabase
        .from('cuotas')
        .select('*')
        .eq('alumno_id', alumno.id)
        .order('año', { ascending: false })
        .order('mes', { ascending: false })
        .limit(12)

      const cuotaActual = cuotas?.find(
        (c) => c.mes === mesActual && c.año === añoActual
      ) ?? null

      const cuotasDeuda = cuotas?.filter(
        (c) => c.estado === 'pendiente' || c.estado === 'vencida'
      ).length ?? 0

      // Prioridad: activa > pendiente (MP aún no confirmó) > ninguna
      const suscripcionActiva =
        alumno.suscripciones?.find((s: { estado: string }) => s.estado === 'activa') ??
        alumno.suscripciones?.find((s: { estado: string }) => s.estado === 'pendiente') ??
        null

      return {
        ...alumno,
        cuota_actual: cuotaActual,
        cuotas_deuda: cuotasDeuda,
        suscripcion_activa: suscripcionActiva,
        historial: cuotas ?? [],
      }
    })
  )

  return { pagador, alumnos: alumnosConCuotas }
}

// ── Agregar otro/a estudiante a una cuenta existente ─────────
export async function agregarEstudianteAction(formData: FormData) {
  const supabase = await createClient()
  const admin    = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Buscar pagador del usuario logueado
  const { data: pagador } = await supabase
    .from('pagadores')
    .select('id')
    .eq('mail', user.email!)
    .maybeSingle()

  if (!pagador) return { error: 'No se encontró tu cuenta de pagador' }

  const nombreAlumno = (formData.get('nombre_alumno') as string).trim()
  const grado        = formData.get('grado') as string
  const turno        = formData.get('turno') as string

  if (!nombreAlumno || !grado || !turno) {
    return { error: 'Completá todos los campos' }
  }

  // Determinar plan según turno
  const turnoNormalized = turno === 'Noche' ? 'nocturno' : 'diurno'

  const { data: plan } = await admin
    .from('planes')
    .select('*')
    .eq('turno', turnoNormalized)
    .eq('tipo', 'mensual')
    .single()

  if (!plan) return { error: 'No se encontró el plan. Contactá a la cooperadora.' }

  // Crear alumno
  const { data: alumno, error: errAlumno } = await admin
    .from('alumnos')
    .insert({ nombre: nombreAlumno, grado, turno, pagador_id: pagador.id, activo: true })
    .select()
    .single()

  if (errAlumno || !alumno) return { error: 'Error al registrar al/la estudiante' }

  // Crear suscripción (manual por defecto, pueden cambiarla después)
  const { error: errSusc } = await admin
    .from('suscripciones')
    .insert({
      alumno_id:    alumno.id,
      plan_id:      plan.id,
      fecha_inicio: new Date().toISOString().split('T')[0],
      estado:       'activa',
      metodo_pago:  'efectivo',
      tipo_pago:    'manual',
      mp_status:    'activa',
    })

  if (errSusc) return { error: 'Error al crear la suscripción' }

  revalidatePath('/cuenta/dashboard')
  return { ok: true }
}
