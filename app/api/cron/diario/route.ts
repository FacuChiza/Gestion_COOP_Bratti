/**
 * Cron diario — corre todos los días a las 9 AM (Argentina) = 12 UTC
 *
 * Política de avisos personalizados (anti-spam):
 *
 *  1) RECORDATORIO MENSUAL (suave): "ya pasó un mes desde tu último aporte"
 *     Trigger: cuotas_deuda > 0 Y han pasado >= 30 días desde el último
 *     pago (o desde el alta del pagador si nunca pagó) Y desde el último
 *     aviso de este tipo. Después de mandarlo, sellamos `ultimo_aviso_mensual`.
 *
 *  2) ALERTA DE MOROSIDAD (firme): "tenés N aportes sin saldar"
 *     Trigger: cuotas_deuda >= meses_alerta_deuda. Solo una vez por mes
 *     calendario. Después de mandarlo, sellamos `ultimo_aviso_deuda`.
 *
 * Excluidos siempre:
 *  • Pagadores con suscripción de débito automático activa (MP cobra solo).
 *  • Alumnos inactivos.
 *
 * Auth: header `Authorization: Bearer ${CRON_SECRET}`. Vercel Cron lo
 * agrega solo si la env var existe.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { wspRecordatorioMensual, wspAlertaDeuda } from '@/lib/twilio'
import { emailRecordatorioMensual, emailAlertaDeuda } from '@/lib/email'

export const dynamic = 'force-dynamic'

const UMBRAL_FALLBACK = 3
const DIAS_ENTRE_RECORDATORIOS = 30

function autenticado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // sin secreto configurado, no se permite ejecutar
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  return token === secret
}

function diasEntre(a: Date, b: Date): number {
  const ms = Math.abs(a.getTime() - b.getTime())
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function primerDiaMesActual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function fechaHoyISO(): string {
  return new Date().toISOString().split('T')[0]
}

function nombreMes(mes: number, año: number): string {
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  return `${meses[mes - 1]} ${año}`
}

export async function GET(req: NextRequest) {
  if (!autenticado(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const hoy = new Date()
  const hoyISO = fechaHoyISO()
  const primerDiaMes = primerDiaMesActual()

  // ── Umbral de morosidad desde configuracion ───────────────────────
  const { data: configRow } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('clave', 'meses_alerta_deuda')
    .maybeSingle()
  const umbralAlerta = configRow?.valor
    ? Number(configRow.valor) || UMBRAL_FALLBACK
    : UMBRAL_FALLBACK

  // ── Pagadores con al menos un alumno activo ──────────────────────
  // Traemos también la suscripción para detectar débito automático.
  const { data: pagadores } = await supabase
    .from('pagadores')
    .select('id, nombre, telefono, mail, created_at, ultimo_aviso_mensual, ultimo_aviso_deuda')

  if (!pagadores) {
    return NextResponse.json({ ok: true, recordatorios: 0, alertas: 0 })
  }

  let recordatorios = 0
  let alertas = 0
  let exentosDebito = 0

  for (const pagador of pagadores) {
    // Alumnos activos vinculados
    const { data: alumnos } = await supabase
      .from('alumnos')
      .select('id, nombre')
      .eq('pagador_id', pagador.id)
      .eq('activo', true)

    if (!alumnos || alumnos.length === 0) continue
    const alumnoIds = alumnos.map((a) => a.id)

    // ¿Tiene débito automático activo en alguno de sus alumnos?
    const { data: suscDebito } = await supabase
      .from('suscripciones')
      .select('id')
      .in('alumno_id', alumnoIds)
      .eq('estado', 'activa')
      .eq('tipo_pago', 'suscripcion')
      .limit(1)

    if (suscDebito && suscDebito.length > 0) {
      exentosDebito++
      continue
    }

    // Cuotas pendientes / vencidas del pagador (de todos sus alumnos)
    // Solo necesitamos `monto` para el total. Evitamos seleccionar `año` por
    // un bug del parser de tipos de supabase-js con caracteres no ASCII.
    const { data: cuotasDeuda } = await supabase
      .from('cuotas')
      .select('monto')
      .in('alumno_id', alumnoIds)
      .in('estado', ['pendiente', 'vencida'])

    const mesesDeuda = cuotasDeuda?.length ?? 0
    const montoTotal = (cuotasDeuda ?? []).reduce(
      (acc: number, c: { monto: number }) => acc + c.monto,
      0,
    )
    if (mesesDeuda === 0) continue

    // Fecha del último pago no anulado
    const { data: ultimoPagoArr } = await supabase
      .from('pagos')
      .select('fecha')
      .eq('pagador_id', pagador.id)
      .eq('anulado', false)
      .order('fecha', { ascending: false })
      .limit(1)

    const fechaUltimoPagoStr = ultimoPagoArr?.[0]?.fecha
    // Si nunca pagó, usamos la fecha de alta como base
    const fechaBaseStr = fechaUltimoPagoStr ?? pagador.created_at.split('T')[0]
    const fechaBase = new Date(fechaBaseStr + 'T00:00:00')
    const dias = diasEntre(hoy, fechaBase)

    // ─────────────────────────────────────────────────────────────
    // 1) RECORDATORIO MENSUAL (suave)
    // ─────────────────────────────────────────────────────────────
    const yaAvisamosDespuesDeBase =
      pagador.ultimo_aviso_mensual !== null &&
      pagador.ultimo_aviso_mensual >= fechaBaseStr

    if (dias >= DIAS_ENTRE_RECORDATORIOS && !yaAvisamosDespuesDeBase) {
      const nombreAlumnos = alumnos.map((a) => a.nombre).join(' y ')
      const mesActualStr = nombreMes(hoy.getMonth() + 1, hoy.getFullYear())

      let enviado = false
      if (pagador.telefono) {
        const ok = await wspRecordatorioMensual({
          telefono:      pagador.telefono,
          nombrePagador: pagador.nombre.split(' ')[0],
          nombreAlumno:  nombreAlumnos,
          mes:           mesActualStr,
          monto:         montoTotal,
          link:          `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/aporte/${pagador.id}`,
        })
        enviado = enviado || ok
      }
      if (pagador.mail) {
        const ok = await emailRecordatorioMensual({
          mail:          pagador.mail,
          nombrePagador: pagador.nombre,
          nombreAlumno:  nombreAlumnos,
          mes:           mesActualStr,
          monto:         montoTotal,
          link:          `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/aporte/${pagador.id}`,
        })
        enviado = enviado || ok
      }

      // Sellamos aunque haya fallado el envío real (evita reintentar
      // infinitamente con cuentas mal configuradas). Si querés reintentar,
      // condicionar este update a `if (enviado)`.
      await supabase
        .from('pagadores')
        .update({ ultimo_aviso_mensual: hoyISO })
        .eq('id', pagador.id)

      if (enviado) recordatorios++
    }

    // ─────────────────────────────────────────────────────────────
    // 2) ALERTA DE MOROSIDAD (firme) — máx. 1 por mes calendario
    // ─────────────────────────────────────────────────────────────
    const yaAvisamosEsteMes =
      pagador.ultimo_aviso_deuda !== null &&
      pagador.ultimo_aviso_deuda >= primerDiaMes

    if (mesesDeuda >= umbralAlerta && !yaAvisamosEsteMes) {
      const nombreAlumnos = alumnos.map((a) => a.nombre).join(' y ')

      let enviado = false
      if (pagador.telefono) {
        const ok = await wspAlertaDeuda({
          telefono:      pagador.telefono,
          nombrePagador: pagador.nombre.split(' ')[0],
          nombreAlumno:  nombreAlumnos,
          mesesDeuda,
          montoTotal,
          link:          `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/aporte/${pagador.id}`,
        })
        enviado = enviado || ok
      }
      if (pagador.mail) {
        const ok = await emailAlertaDeuda({
          mail:          pagador.mail,
          nombrePagador: pagador.nombre,
          nombreAlumno:  nombreAlumnos,
          mesesDeuda,
          montoTotal,
          link:          `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/aporte/${pagador.id}`,
        })
        enviado = enviado || ok
      }

      await supabase
        .from('pagadores')
        .update({ ultimo_aviso_deuda: hoyISO })
        .eq('id', pagador.id)

      if (enviado) alertas++
    }
  }

  return NextResponse.json({
    ok: true,
    recordatorios,
    alertas,
    exentosDebito,
    umbralAlerta,
  })
}
