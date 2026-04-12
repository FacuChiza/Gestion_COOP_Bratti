'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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

      const suscripcionActiva = alumno.suscripciones?.find(
        (s: { estado: string }) => s.estado === 'activa'
      ) ?? null

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
