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
