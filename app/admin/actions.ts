'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { wspConfirmacionPago } from '@/lib/twilio'
import { enviarRecibo } from '@/lib/email'
import { formatMes } from '@/lib/utils'
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

  // Devolvemos también inactivos: la UI los oculta por defecto pero deja
  // un toggle para verlos y reactivarlos.
  const { data: alumnos, error } = await admin
    .from('alumnos')
    .select('*, pagadores(*)')
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
  const descuentoRaw = formData.get('descuento') as string | null
  const metodoForm = (formData.get('metodo') as string | null) ?? 'efectivo'
  const metodo = ['efectivo', 'transferencia', 'mercadopago'].includes(metodoForm) ? metodoForm : 'efectivo'

  if (!pagadorId || cuotaIds.length === 0) {
    return { error: 'Faltan datos requeridos' }
  }

  // Calcular monto bruto y aplicar descuento (si existe)
  const { data: cuotas } = await admin
    .from('cuotas')
    .select('monto')
    .in('id', cuotaIds)

  const montoBruto = cuotas?.reduce((acc, c) => acc + c.monto, 0) ?? 0
  let descuento = Math.round(Number(descuentoRaw ?? 0))
  if (isNaN(descuento) || descuento < 0) descuento = 0

  // Tope: leemos descuento_maximo_porcentaje desde configuracion
  const { data: conf } = await admin
    .from('configuracion')
    .select('valor')
    .eq('clave', 'descuento_maximo_porcentaje')
    .maybeSingle()
  const topePct = conf?.valor ? Number(conf.valor) : 100
  const topeAbs = (montoBruto * topePct) / 100
  if (descuento > topeAbs) {
    return { error: `El descuento supera el máximo permitido (${topePct}% = ${topeAbs.toFixed(0)})` }
  }
  if (descuento > montoBruto) {
    return { error: 'El descuento no puede ser mayor al total' }
  }

  const montoTotal = montoBruto - descuento

  // Crear el pago
  const { data: pago, error: errorPago } = await admin
    .from('pagos')
    .insert({
      pagador_id:  pagadorId,
      monto:       montoTotal,
      descuento,
      fecha:       new Date().toISOString().split('T')[0],
      metodo,
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

  // ── Notificaciones al pagador ──────────────────────────────
  const { data: pagadorInfo } = await admin
    .from('pagadores')
    .select('nombre, telefono, mail')
    .eq('id', pagadorId)
    .single()

  // Traer detalles de cuotas para el recibo
  type CuotaDetalle = { mes: number; año: number; monto: number; alumnos: { nombre: string } | null }
  const { data: rawDetalle } = await admin
    .from('cuotas')
    .select('*, alumnos(nombre)')
    .in('id', cuotaIds)
  const cuotasDetalle = rawDetalle as unknown as CuotaDetalle[] | null

  if (pagadorInfo && cuotasDetalle?.length) {
    const mesNombre = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(new Date())

    const nombresAlumnos = [...new Set(
      cuotasDetalle.map(c => c.alumnos?.nombre).filter(Boolean) as string[]
    )]

    if (pagadorInfo.telefono) {
      await wspConfirmacionPago({
        telefono:      pagadorInfo.telefono,
        nombrePagador: pagadorInfo.nombre.split(' ')[0],
        nombreAlumno:  nombresAlumnos.join(' y '),
        mes:           mesNombre,
        monto:         montoTotal,
      })
    }

    if (pagadorInfo.mail) {
      await enviarRecibo({
        mail:          pagadorInfo.mail,
        nombrePagador: pagadorInfo.nombre,
        nombreAlumno:  nombresAlumnos,
        cuotas: cuotasDetalle.map(c => ({
          mes:   formatMes(c.mes, c.año),
          monto: c.monto,
        })),
        montoTotal,
        metodoPago: 'efectivo',
        nroRecibo:  pago.id,
        pagadorId,
      })
    }
  }

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

// ─── Actualizar precio de un plan ────────────────────────────────────────────
// IMPORTANTE: en el schema, planes.precio_por_mes es una columna GENERATED
// (monto_total / cantidad_meses). Por eso solo actualizamos monto_total y
// cantidad_meses; el precio_por_mes se recalcula automáticamente en Postgres.

export async function actualizarPrecio(formData: FormData) {
  const admin = createAdminClient()

  const planId        = formData.get('plan_id')        as string
  const montoTotal    = Math.round(Number(formData.get('monto_total')))
  const cantidadMeses = Number(formData.get('cantidad_meses'))

  if (!planId) {
    return { error: 'Plan inválido' }
  }
  if (isNaN(montoTotal) || montoTotal <= 0) {
    return { error: 'El monto total debe ser mayor a 0' }
  }
  if (isNaN(cantidadMeses) || cantidadMeses <= 0) {
    return { error: 'La cantidad de meses debe ser mayor a 0' }
  }

  const { error } = await admin
    .from('planes')
    .update({ monto_total: montoTotal, cantidad_meses: cantidadMeses })
    .eq('id', planId)

  if (error) {
    console.error('[actualizarPrecio]', error)
    return { error: 'Error al actualizar el plan' }
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

// ═══════════════════════════════════════════════════════════════════════════
//   ADMIN AVANZADO — operaciones que un directivo necesita poder hacer
//   sin pedir ayuda a un programador.
// ═══════════════════════════════════════════════════════════════════════════

// ─── CONFIGURACIÓN GENERAL (clave/valor) ─────────────────────────────────────

export async function getConfiguracion() {
  const admin = createAdminClient()
  const { data } = await admin.from('configuracion').select('*').order('clave')
  return data ?? []
}

export async function actualizarConfiguracion(formData: FormData) {
  const admin = createAdminClient()
  const clave = formData.get('clave') as string
  const valor = (formData.get('valor') as string ?? '').trim()

  if (!clave) return { error: 'Clave inválida' }
  if (!valor) return { error: 'El valor no puede estar vacío' }

  // Validaciones específicas por clave conocida
  const numericKeys = ['meses_alerta_deuda', 'descuento_maximo_porcentaje', 'dia_vencimiento']
  if (numericKeys.includes(clave)) {
    const n = Number(valor)
    if (isNaN(n) || n < 0) return { error: 'Debe ser un número mayor o igual a 0' }
    if (clave === 'descuento_maximo_porcentaje' && n > 100) {
      return { error: 'El porcentaje no puede ser mayor a 100' }
    }
    if (clave === 'dia_vencimiento' && (n < 1 || n > 28)) {
      return { error: 'El día debe estar entre 1 y 28' }
    }
  }

  const { error } = await admin
    .from('configuracion')
    .upsert({ clave, valor }, { onConflict: 'clave' })

  if (error) {
    console.error('[actualizarConfiguracion]', error)
    return { error: 'Error al guardar' }
  }
  revalidatePath('/admin')
  return { success: true }
}

// ─── EDITAR ALUMNO ───────────────────────────────────────────────────────────

export async function editarAlumno(formData: FormData) {
  const admin = createAdminClient()
  const alumnoId = formData.get('alumno_id') as string
  const nombre   = (formData.get('nombre') as string ?? '').trim()
  const grado    = (formData.get('grado')  as string ?? '').trim()
  const turno    = (formData.get('turno')  as string ?? '').trim() || null
  const notas    = (formData.get('notas')  as string ?? '').trim() || null

  if (!alumnoId || !nombre || !grado) {
    return { error: 'Nombre y grado son obligatorios' }
  }

  const { error } = await admin
    .from('alumnos')
    .update({ nombre, grado, turno, notas })
    .eq('id', alumnoId)

  if (error) {
    console.error('[editarAlumno]', error)
    return { error: 'Error al actualizar el alumno' }
  }
  revalidatePath('/admin')
  return { success: true }
}

export async function cambiarEstadoAlumno(formData: FormData) {
  const admin = createAdminClient()
  const alumnoId = formData.get('alumno_id') as string
  const activo   = formData.get('activo') === 'true'

  if (!alumnoId) return { error: 'Alumno inválido' }

  const { error } = await admin
    .from('alumnos')
    .update({ activo })
    .eq('id', alumnoId)

  if (error) return { error: 'Error al cambiar el estado' }

  // Si se desactiva, también pausamos su suscripción para que el cron deje
  // de generar aportes nuevos.
  if (!activo) {
    await admin
      .from('suscripciones')
      .update({ estado: 'cancelada' })
      .eq('alumno_id', alumnoId)
      .eq('estado', 'activa')
  }

  revalidatePath('/admin')
  return { success: true }
}

// ─── EDITAR PAGADOR ──────────────────────────────────────────────────────────

export async function editarPagador(formData: FormData) {
  const admin = createAdminClient()
  const pagadorId = formData.get('pagador_id') as string
  const nombre    = (formData.get('nombre')   as string ?? '').trim()
  const dni       = (formData.get('dni')      as string ?? '').trim() || null
  const telefono  = (formData.get('telefono') as string ?? '').trim() || null
  const mail      = (formData.get('mail')     as string ?? '').trim().toLowerCase()
  const notas     = (formData.get('notas')    as string ?? '').trim() || null

  if (!pagadorId || !nombre || !mail) {
    return { error: 'Nombre y mail son obligatorios' }
  }

  // Si cambia el mail, también lo actualizamos en Supabase Auth para que
  // RLS siga funcionando (las políticas matchean por auth.email()).
  const { data: pagadorActual } = await admin
    .from('pagadores')
    .select('mail')
    .eq('id', pagadorId)
    .single()

  if (pagadorActual && pagadorActual.mail !== mail) {
    // Buscar el user de auth por el mail viejo
    const { data: usuarios } = await admin.auth.admin.listUsers()
    const user = usuarios?.users.find((u) => u.email === pagadorActual.mail)
    if (user) {
      const { error: errAuth } = await admin.auth.admin.updateUserById(user.id, { email: mail })
      if (errAuth) {
        return { error: `No se pudo actualizar el email de la cuenta: ${errAuth.message}` }
      }
    }
  }

  const { error } = await admin
    .from('pagadores')
    .update({ nombre, dni, telefono, mail, notas })
    .eq('id', pagadorId)

  if (error) {
    console.error('[editarPagador]', error)
    return { error: 'Error al actualizar el pagador' }
  }
  revalidatePath('/admin')
  return { success: true }
}

// ─── ANULAR PAGO (soft delete con auditoría) ─────────────────────────────────

export async function anularPago(formData: FormData) {
  const admin = createAdminClient()
  const pagoId = formData.get('pago_id') as string
  const motivo = (formData.get('motivo') as string ?? '').trim()

  if (!pagoId) return { error: 'Pago inválido' }
  if (!motivo) return { error: 'Indicá un motivo de anulación (obligatorio para auditoría)' }

  // Buscar las cuotas que saldó este pago para revertirlas a "vencida"
  const { data: vinculos } = await admin
    .from('pagos_cuotas')
    .select('cuota_id')
    .eq('pago_id', pagoId)

  const cuotaIds = (vinculos ?? []).map((v) => v.cuota_id)

  // Marcar pago como anulado (no se borra de la base)
  const { error: errPago } = await admin
    .from('pagos')
    .update({
      anulado: true,
      motivo_anulacion: motivo,
      anulado_at: new Date().toISOString(),
      anulado_por: 'admin',
    })
    .eq('id', pagoId)

  if (errPago) {
    console.error('[anularPago]', errPago)
    return { error: 'Error al anular el pago' }
  }

  // Revertir cuotas saldadas a "vencida" para que el alumno aparezca
  // de nuevo como con aporte pendiente.
  if (cuotaIds.length > 0) {
    await admin
      .from('cuotas')
      .update({ estado: 'vencida' })
      .in('id', cuotaIds)
  }

  revalidatePath('/admin')
  return { success: true, cuotasRevertidas: cuotaIds.length }
}

// ─── CAMBIAR PLAN DE UN ALUMNO ───────────────────────────────────────────────
// Estrategia: cancelamos la suscripción activa actual y creamos una nueva
// con el plan elegido. Los aportes ya generados (cuotas pendientes/vencidas)
// NO se modifican — el cambio aplica desde el próximo aporte que genere el cron.

export async function cambiarPlanAlumno(formData: FormData) {
  const admin = createAdminClient()
  const alumnoId  = formData.get('alumno_id')  as string
  const nuevoPlan = formData.get('plan_id')    as string

  if (!alumnoId || !nuevoPlan) return { error: 'Faltan datos' }

  // Verificar que el plan exista
  const { data: plan } = await admin
    .from('planes')
    .select('id, tipo')
    .eq('id', nuevoPlan)
    .maybeSingle()

  if (!plan) return { error: 'Plan inexistente' }

  // Cancelar suscripciones activas/pendientes anteriores
  await admin
    .from('suscripciones')
    .update({ estado: 'cancelada' })
    .eq('alumno_id', alumnoId)
    .in('estado', ['activa', 'pendiente'])

  // Crear la nueva suscripción
  const { error } = await admin.from('suscripciones').insert({
    alumno_id:    alumnoId,
    plan_id:      nuevoPlan,
    fecha_inicio: new Date().toISOString().split('T')[0],
    estado:       'activa',
    metodo_pago:  'efectivo',
    tipo_pago:    plan.tipo === 'anual' ? 'anual' : 'manual',
    mp_status:    'activa',
  })

  if (error) {
    console.error('[cambiarPlanAlumno]', error)
    return { error: 'Error al crear la nueva suscripción' }
  }

  revalidatePath('/admin')
  return { success: true }
}

// ─── LISTADO DE PAGOS PARA UI (con detalle de cuotas saldadas) ───────────────

export async function getPagosRecientes(opts?: {
  incluirAnulados?: boolean
  limit?: number
}) {
  const admin = createAdminClient()
  const limit = opts?.limit ?? 100

  let query = admin
    .from('pagos')
    .select('*, pagadores(nombre, mail, telefono)')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!opts?.incluirAnulados) {
    query = query.eq('anulado', false)
  }

  const { data: pagos } = await query
  if (!pagos || pagos.length === 0) return []

  // Detalle de cuotas saldadas por cada pago
  const pagoIds = pagos.map((p) => p.id)
  type Vinculo = {
    pago_id: string
    cuotas: { mes: number; año: number; alumnos: { nombre: string } | null } | null
  }
  const { data: vinculos } = await admin
    .from('pagos_cuotas')
    .select('pago_id, cuotas(mes, año, alumnos(nombre))')
    .in('pago_id', pagoIds)

  const detallePorPago = new Map<string, Array<{ mes: number; año: number; alumno: string }>>()
  for (const v of (vinculos as unknown as Vinculo[] | null) ?? []) {
    if (!v.cuotas) continue
    const arr = detallePorPago.get(v.pago_id) ?? []
    arr.push({
      mes: v.cuotas.mes,
      año: v.cuotas.año,
      alumno: v.cuotas.alumnos?.nombre ?? '',
    })
    detallePorPago.set(v.pago_id, arr)
  }

  return pagos.map((p) => ({
    ...p,
    cuotas_detalle: detallePorPago.get(p.id) ?? [],
  }))
}

// ─── GENERAR APORTE MANUAL (fuera del cron) ──────────────────────────────────

export async function generarAporteManual(formData: FormData) {
  const admin = createAdminClient()
  const alumnoId = formData.get('alumno_id') as string
  const mes      = Number(formData.get('mes'))
  const año      = Number(formData.get('año'))
  const monto    = Math.round(Number(formData.get('monto')))

  if (!alumnoId || !mes || !año || !monto) {
    return { error: 'Faltan datos' }
  }
  if (mes < 1 || mes > 12) return { error: 'Mes inválido' }
  if (monto <= 0) return { error: 'El monto debe ser mayor a 0' }

  // Buscar la suscripción activa para vincular
  const { data: susc } = await admin
    .from('suscripciones')
    .select('id')
    .eq('alumno_id', alumnoId)
    .eq('estado', 'activa')
    .maybeSingle()

  if (!susc) return { error: 'El alumno no tiene una suscripción activa' }

  const { error } = await admin.from('cuotas').insert({
    alumno_id: alumnoId,
    suscripcion_id: susc.id,
    mes, año, monto,
    estado: 'pendiente',
  })

  if (error) {
    // El UNIQUE(alumno_id, mes, año) puede chocar
    if (error.code === '23505') return { error: 'Ya existe un aporte para ese mes/año' }
    return { error: 'Error al crear el aporte' }
  }

  revalidatePath('/admin')
  return { success: true }
}

