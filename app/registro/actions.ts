'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type RegistroResult =
  | { ok: true; pagadorId: string; tipoPago: string }
  | { ok: false; error: string }

export async function registrarPagadorPublico(
  formData: FormData
): Promise<RegistroResult> {
  const supabase = await createClient()
  const admin   = createAdminClient()

  // ── Datos del pagador ──────────────────────────────────────
  const nombre    = (formData.get('nombre')   as string).trim()
  const email     = (formData.get('email')    as string).trim().toLowerCase()
  const telefono  = (formData.get('telefono') as string).trim()
  const password  = formData.get('password')  as string

  // ── Datos del alumno ───────────────────────────────────────
  const nombreAlumno = (formData.get('nombre_alumno') as string).trim()
  const grado        = formData.get('grado')           as string
  const turno        = formData.get('turno')           as string   // 'Mañana' | 'Tarde' | 'Noche'
  const tipoPago     = formData.get('tipo_pago')       as string   // 'suscripcion' | 'anual' | 'manual'

  if (!nombre || !email || !telefono || !password || !nombreAlumno || !grado || !turno || !tipoPago) {
    return { ok: false, error: 'Completá todos los campos.' }
  }
  if (password.length < 6) {
    return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' }
  }

  // ── Verificar que el mail no esté registrado ya ────────────
  const { data: existente } = await supabase
    .from('pagadores')
    .select('id')
    .eq('mail', email)
    .maybeSingle()

  if (existente) {
    return { ok: false, error: 'Ya existe una cuenta con ese email. Podés ingresar desde el portal.' }
  }

  // ── Determinar plan según turno ────────────────────────────
  const turnoNormalized = turno.toLowerCase() === 'noche' ? 'nocturno' : 'diurno'
  const tipoplan = tipoPago === 'anual' ? 'anual' : 'mensual'

  // Usamos admin para bypasear RLS — planes es data pública pero el usuario aún no está autenticado
  const { data: plan } = await admin
    .from('planes')
    .select('*')
    .eq('turno', turnoNormalized)
    .eq('tipo', tipoplan)
    .single()

  if (!plan) {
    return { ok: false, error: 'No se encontró el plan correspondiente. Contactá a la cooperadora.' }
  }

  // ── Crear usuario en Supabase Auth ─────────────────────────
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) {
    if (authError.message.includes('already registered')) {
      return { ok: false, error: 'Ya existe una cuenta con ese email.' }
    }
    return { ok: false, error: 'Error al crear tu cuenta. Intentá de nuevo.' }
  }

  // ── Crear pagador ──────────────────────────────────────────
  // Usamos admin en todo el flujo de registro porque el usuario
  // no está autenticado aún y RLS bloquearía las inserciones
  const { data: pagador, error: errPagador } = await admin
    .from('pagadores')
    .insert({ nombre, mail: email, telefono })
    .select()
    .single()

  if (errPagador || !pagador) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return { ok: false, error: 'Error al guardar tus datos. Intentá de nuevo.' }
  }

  // ── Crear alumno ───────────────────────────────────────────
  const { data: alumno, error: errAlumno } = await admin
    .from('alumnos')
    .insert({ nombre: nombreAlumno, grado, turno, pagador_id: pagador.id, activo: true })
    .select()
    .single()

  if (errAlumno || !alumno) {
    return { ok: false, error: 'Error al registrar al alumno. Contactá a la cooperadora.' }
  }

  // ── Crear suscripción ──────────────────────────────────────
  const mpStatus = tipoPago === 'manual' ? 'activa' : 'pending'

  const { data: suscripcion, error: errSusc } = await admin
    .from('suscripciones')
    .insert({
      alumno_id:  alumno.id,
      plan_id:    plan.id,
      fecha_inicio: new Date().toISOString().split('T')[0],
      estado:     tipoPago === 'manual' ? 'activa' : 'pendiente',
      metodo_pago: tipoPago === 'manual' ? 'efectivo' : 'mercadopago',
      tipo_pago:  tipoPago,
      mp_status:  mpStatus,
    })
    .select()
    .single()

  if (errSusc || !suscripcion) {
    return { ok: false, error: 'Error al crear la suscripción.' }
  }

  return { ok: true, pagadorId: pagador.id, tipoPago }
}
