'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { crearSuscripcionMP } from '@/lib/mp'

/**
 * Activa el débito automático para TODOS los alumnos activos del pagador.
 *
 * Estrategia:
 *  - Si el alumno ya tiene una suscripción activa de tipo 'manual' o 'anual',
 *    la cancelamos y creamos una nueva tipo 'suscripcion' apuntando al plan
 *    mensual del turno correspondiente.
 *  - Disparamos el preapproval de MP. El usuario carga la tarjeta una vez y
 *    MP cobra solo cada mes.
 *
 * Si tiene varios alumnos, hoy creamos un preapproval por cada uno (MP no
 * permite agrupar múltiples montos en un solo preapproval). Devolvemos la
 * URL del PRIMER preapproval — los demás quedan creados como pendientes y
 * el padre los confirma desde el portal.
 */
export async function activarDebitoAutomatico(pagadorId: string): Promise<{
  ok?: true
  initPoint?: string
  totalActivados?: number
  error?: string
}> {
  const admin = createAdminClient()

  // 1. Pagador
  const { data: pagador } = await admin
    .from('pagadores')
    .select('id, nombre, mail')
    .eq('id', pagadorId)
    .maybeSingle()

  if (!pagador) return { error: 'Pagador no encontrado' }
  if (!pagador.mail) return { error: 'El pagador no tiene email cargado. Contactá a la cooperadora.' }

  // 2. Alumnos activos del pagador
  const { data: alumnos } = await admin
    .from('alumnos')
    .select('id, nombre, turno')
    .eq('pagador_id', pagadorId)
    .eq('activo', true)

  if (!alumnos || alumnos.length === 0) {
    return { error: 'No hay estudiantes activos asociados a tu cuenta.' }
  }

  let primeraInitPoint: string | null = null
  let creadas = 0

  for (const alumno of alumnos) {
    // Buscar el plan mensual del turno del alumno
    const turnoKey = (alumno.turno ?? '').toLowerCase() === 'noche' ? 'nocturno' : 'diurno'
    const { data: plan } = await admin
      .from('planes')
      .select('id, nombre, precio_por_mes')
      .eq('turno', turnoKey)
      .eq('tipo', 'mensual')
      .maybeSingle()

    if (!plan) continue

    // Cancelar suscripciones activas/pendientes que NO sean de débito automático
    await admin
      .from('suscripciones')
      .update({ estado: 'cancelada' })
      .eq('alumno_id', alumno.id)
      .in('estado', ['activa', 'pendiente'])
      .neq('tipo_pago', 'suscripcion')

    // Crear nueva suscripción tipo 'suscripcion' (débito automático)
    const { data: nuevaSusc, error: errSusc } = await admin
      .from('suscripciones')
      .insert({
        alumno_id:    alumno.id,
        plan_id:      plan.id,
        fecha_inicio: new Date().toISOString().split('T')[0],
        estado:       'pendiente',
        metodo_pago:  'mercadopago',
        tipo_pago:    'suscripcion',
        mp_status:    'pending',
      })
      .select('id')
      .single()

    if (errSusc || !nuevaSusc) {
      console.error('[activarDebito] error creando suscripción', errSusc)
      continue
    }

    // Disparar preapproval en MP
    const mp = await crearSuscripcionMP({
      pagadorNombre: pagador.nombre,
      pagadorEmail:  pagador.mail,
      monto:         plan.precio_por_mes,
      planNombre:    `${plan.nombre} — ${alumno.nombre}`,
      suscripcionId: nuevaSusc.id,
    })

    if (mp.ok) {
      // Guardamos el preapproval_id para el webhook
      await admin
        .from('suscripciones')
        .update({ mp_preapproval_id: mp.id })
        .eq('id', nuevaSusc.id)

      if (!primeraInitPoint) primeraInitPoint = mp.init_point
      creadas++
    } else {
      console.error('[activarDebito] MP rechazó preapproval:', mp.error)
      // Borramos la suscripción huérfana para no contaminar la base
      await admin.from('suscripciones').delete().eq('id', nuevaSusc.id)
    }
  }

  if (creadas === 0) {
    return { error: 'No se pudo iniciar el débito automático con MercadoPago. Probá más tarde o acercate a la cooperadora.' }
  }

  return {
    ok: true,
    initPoint: primeraInitPoint!,
    totalActivados: creadas,
  }
}
