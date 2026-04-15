'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AlumnoConEstado } from '@/types'

// ─── Datos para el panel ──────────────────────────────────────────────────────
// NOTA: Las lecturas usan createClient() (respeta RLS en modo lectura).
// Las escrituras usan createAdminClient() porque el admin se autentica por
// HTTP Basic Auth, no por Supabase Auth, por lo que RLS bloquearía los INSERTs.

export async function getAlumnosConEstado(): Promise<AlumnoConEstado[]> {
  const admin = createAdminClient()
  const ahora = new Date()
  const mesActual = ahora.getMonth() + 1
  const añoActual = ahora.getFullYear()

  const { data: alumnos, error } = await admin
    .from('alumnos')
    .select('*, pagadores(*)')
    .eq('activo', true)
    .order('nombre')

  if (error || !alumnos) return []

  const resultado: AlumnoConEstado[] = await Promise.all(
    alumnos.map(async (alumno) => {
      const { data: cuotaActual } = await admin
        .from('cuotas')
        .select('*')
        .eq('alumno_id', alumno.id)
        .eq('mes', mesActual)
        .eq('año', añoActual)
        .maybeSingle()

      const { count: cuotasDeuda } = await admin
        .from('cuotas')
        .select('*', { count: 'exact', head: true })
        .eq('alumno_id', alumno.id)
        .in('estado', ['pendiente', 'vencida'])

      // Incluye suscripciones 'pendiente' (MP aún no confirmó)
      const { data: suscripcion } = await admin
        .from('suscripciones')
        .select('*, planes(*)')
        .eq('alumno_id', alumno.id)
        .in('estado', ['activa', 'pendiente'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      return {
        ...alumno,
        cuota_actual: cuotaActual ?? null,
        cuotas_deuda: cuotasDeuda ?? 0,
        suscripcion_activa: suscripcion ?? null,
      }
    })
  )

  return resultado
}

export async function getAlumnosConDeuda(minMeses: number = 3) {
  const admin = createAdminClient()

  const { data: alumnos } = await admin
    .from('alumnos')
    .select('*, pagadores(*)')
    .eq('activo', true)

  if (!alumnos) return []

  const conDeuda = await Promise.all(
    alumnos.map(async (alumno) => {
      const { count } = await admin
        .from('cuotas')
        .select('*', { count: 'exact', head: true })
        .eq('alumno_id', alumno.id)
        .in('estado', ['pendiente', 'vencida'])

      return { ...alumno, cuotas_deuda: count ?? 0 }
    })
  )

  return conDeuda.filter((a) => a.cuotas_deuda >= minMeses)
}

export async function getCuotasPendientesAlumno(alumnoId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('cuotas')
    .select('*')
    .eq('alumno_id', alumnoId)
    .in('estado', ['pendiente', 'vencida'])
    .order('año')
    .order('mes')

  return data ?? []
}

export async function getPlanes() {
  const admin = createAdminClient()
  const { data } = await admin.from('planes').select('*').order('monto_total')
  return data ?? []
}

export async function getPagadores() {
  const admin = createAdminClient()
  const { data } = await admin.from('pagadores').select('*').order('nombre')
  return data ?? []
}

// ─── Registrar pago en efectivo ───────────────────────────────────────────────

export async function registrarPago(formData: FormData) {
  // Usa admin client: el panel admin usa HTTP Basic Auth, no Supabase Auth,
  // por lo que RLS bloquearía los INSERTs con el client normal.
  const admin = createAdminClient()

  const pagadorId = formData.get('pagador_id') as string
  const cuotaIds  = formData.getAll('cuota_ids') as string[]
  const notas     = formData.get('notas') as string | null

  if (!pagadorId || cuotaIds.length === 0) {
    return { error: 'Faltan datos requeridos' }
  }

  // Calcular monto total de las cuotas seleccionadas
  const { data: cuotas } = await admin
    .from('cuotas')
    .select('monto')
    .in('id', cuotaIds)

  const montoTotal = cuotas?.reduce((acc, c) => acc + c.monto, 0) ?? 0

  // Crear el pago
  const { data: pago, error: errorPago } = await admin
    .from('pagos')
    .insert({
      pagador_id:  pagadorId,
      monto:       montoTotal,
      descuento:   0,
      fecha:       new Date().toISOString().split('T')[0],
      metodo:      'efectivo',
      registrado_por: 'admin',
      notas:       notas || null,
    })
    .select()
    .single()

  if (errorPago || !pago) {
    console.error('[registrarPago]', errorPago)
    return { error: 'Error al crear el pago' }
  }

  // Relacionar pago con cuotas
  await admin.from('pagos_cuotas').insert(
    cuotaIds.map((cuotaId) => ({ pago_id: pago.id, cuota_id: cuotaId }))
  )

  // Marcar cuotas como pagadas
  await admin
    .from('cuotas')
    .update({ estado: 'pagada' })
    .in('id', cuotaIds)

  revalidatePath('/admin')
  return { success: true, pagoId: pago.id }
}

// ─── Alta pagador + alumno ────────────────────────────────────────────────────

export async function altaPagadorYAlumno(formData: FormData) {
  const admin = createAdminClient()

  const nombre       = formData.get('nombre')       as string
  const dni          = formData.get('dni')           as string
  const telefono     = formData.get('telefono')      as string
  const mail         = formData.get('mail')          as string
  const password     = formData.get('password')      as string
  const nombreAlumno = formData.get('nombre_alumno') as string
  const grado        = formData.get('grado')         as string
  const turno        = formData.get('turno')         as string
  const planId       = formData.get('plan_id')       as string

  if (!nombre || !mail || !password || !nombreAlumno || !grado || !planId) {
    return { error: 'Completá todos los campos obligatorios' }
  }

  // Crear usuario en Supabase Auth
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: mail,
    password,
    email_confirm: true,
  })

  if (authError) {
    const msg = authError.message.toLowerCase()
    if (msg.includes('already') || msg.includes('exist') || msg.includes('registered')) {
      return { error: 'Ya existe un usuario con ese email' }
    }
    return { error: `Error al crear usuario: ${authError.message}` }
  }

  // Crear pagador
  const { data: pagador, error: errorPagador } = await admin
    .from('pagadores')
    .insert({ nombre, dni: dni || null, telefono: telefono || null, mail })
    .select()
    .single()

  if (errorPagador || !pagador) {
    await admin.auth.admin.deleteUser(authUser.user.id)
    return { error: 'Error al crear el pagador' }
  }

  // Crear alumno
  const { data: alumno, error: errorAlumno } = await admin
    .from('alumnos')
    .insert({ nombre: nombreAlumno, grado, turno: turno || null, pagador_id: pagador.id, activo: true })
    .select()
    .single()

  if (errorAlumno || !alumno) {
    return { error: 'Error al crear el alumno' }
  }

  // Crear suscripción (alta admin → siempre manual/efectivo)
  const { error: errorSusc } = await admin.from('suscripciones').insert({
    alumno_id:    alumno.id,
    plan_id:      planId,
    fecha_inicio: new Date().toISOString().split('T')[0],
    estado:       'activa',
    metodo_pago:  'efectivo',
    tipo_pago:    'manual',
    mp_status:    'activa',
  })

  if (errorSusc) {
    return { error: 'Error al crear la suscripción' }
  }

  revalidatePath('/admin')
  return { success: true }
}

// ─── Simulación de cron mensual ───────────────────────────────────────────────

export async function ejecutarCronMensual() {
  const admin = createAdminClient()
  const ahora = new Date()
  const mesActual  = ahora.getMonth() + 1
  const añoActual  = ahora.getFullYear()

  const fechaMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1)
  const mesAnterior  = fechaMesAnterior.getMonth() + 1
  const añoAnterior  = fechaMesAnterior.getFullYear()

  let cuotasGeneradas = 0
  let cuotasVencidas  = 0

  // 1. Marcar pendientes del mes anterior como vencidas
  const { count: totalParaVencer } = await admin
    .from('cuotas')
    .select('*', { count: 'exact', head: true })
    .eq('mes', mesAnterior)
    .eq('año', añoAnterior)
    .eq('estado', 'pendiente')

  cuotasVencidas = totalParaVencer ?? 0

  await admin
    .from('cuotas')
    .update({ estado: 'vencida' })
    .eq('mes', mesAnterior)
    .eq('año', añoAnterior)
    .eq('estado', 'pendiente')

  // 2. Generar cuotas del mes actual para suscripciones activas
  const { data: suscripciones } = await admin
    .from('suscripciones')
    .select('*, planes(*), alumnos(*)')
    .eq('estado', 'activa')

  if (suscripciones) {
    for (const susc of suscripciones) {
      const { data: existente } = await admin
        .from('cuotas')
        .select('id')
        .eq('alumno_id', susc.alumno_id)
        .eq('mes', mesActual)
        .eq('año', añoActual)
        .maybeSingle()

      if (!existente && susc.planes) {
        const { error } = await admin.from('cuotas').insert({
          alumno_id:     susc.alumno_id,
          suscripcion_id: susc.id,
          mes:           mesActual,
          año:           añoActual,
          monto:         susc.planes.precio_por_mes,
          estado:        'pendiente',
        })
        if (!error) cuotasGeneradas++
      }
    }
  }

  revalidatePath('/admin')
  return { success: true, cuotasGeneradas, cuotasVencidas }
}
