/**
 * Endpoints de exportación a Excel (.xlsx) para el panel admin.
 *
 * Tipos disponibles (param `tipo`):
 *   - alumnos    → todos los alumnos con su pagador, plan y estado actual
 *   - pagadores  → pagadores con totales aportados
 *   - aportes    → cuotas (con filtros opcionales ?año= &mes=)
 *   - pagos      → pagos realizados (con filtro opcional ?año= &mes=)
 *
 * Auth: protegido por el mismo HTTP Basic del middleware (matcher /api/admin/*).
 */

import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fechaCorta } from '@/lib/csv'
import { generarExcel, excelResponse } from '@/lib/excel'

export const dynamic = 'force-dynamic'

const NOMBRE_MES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

function nombreArchivo(tipo: string, sufijo = ''): string {
  const hoy = new Date().toISOString().split('T')[0]
  const s = sufijo ? `_${sufijo}` : ''
  return `coop_${tipo}${s}_${hoy}.xlsx`
}

// ─── Tipos auxiliares ─────────────────────────────────────────────────────────

type AlumnoRow = {
  id: string
  nombre: string
  grado: string
  turno: string | null
  activo: boolean
  created_at: string
  pagadores: { id: string; nombre: string; mail: string; telefono: string | null; dni: string | null } | null
}

type SuscripcionRow = {
  alumno_id: string
  estado: string
  tipo_pago: string
  metodo_pago: string
  mp_status: string | null
  fecha_inicio: string
  planes: { nombre: string; precio_por_mes: number; monto_total: number; turno: string | null; tipo: string | null } | null
}

type CuotaRow = {
  id: string
  alumno_id: string
  mes: number
  monto: number
  estado: string
  created_at: string
  alumnos: { nombre: string; grado: string; turno: string | null; pagadores: { nombre: string; mail: string } | null } | null
}

type PagoRow = {
  id: string
  pagador_id: string
  monto: number
  descuento: number
  fecha: string
  metodo: string
  registrado_por: string
  referencia_externa: string | null
  notas: string | null
  anulado: boolean | null
  motivo_anulacion: string | null
  anulado_at: string | null
  pagadores: { nombre: string; mail: string; telefono: string | null } | null
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { tipo: string } }
) {
  const tipo = params.tipo
  const url = new URL(req.url)
  const año = url.searchParams.get('año') ?? url.searchParams.get('anio')
  const mes = url.searchParams.get('mes')

  const admin = createAdminClient()

  // ════════════════════════════════════════════════════════════════════
  // 1) ALUMNOS
  // ════════════════════════════════════════════════════════════════════
  if (tipo === 'alumnos') {
    const { data: alumnos } = await admin
      .from('alumnos')
      .select('id, nombre, grado, turno, activo, created_at, pagadores(id, nombre, mail, telefono, dni)')
      .order('nombre')

    const lista = (alumnos as unknown as AlumnoRow[] | null) ?? []

    // Traer la suscripción activa más reciente de cada alumno
    const alumnoIds = lista.map((a) => a.id)
    const { data: suscs } = alumnoIds.length
      ? await admin
          .from('suscripciones')
          .select('alumno_id, estado, tipo_pago, metodo_pago, mp_status, fecha_inicio, planes(nombre, precio_por_mes, monto_total, turno, tipo)')
          .in('alumno_id', alumnoIds)
      : { data: [] }

    const suscripciones = (suscs as unknown as SuscripcionRow[] | null) ?? []
    const suscripcionPorAlumno = new Map<string, SuscripcionRow>()
    for (const s of suscripciones) {
      // priorizar activa > pendiente > otros
      const existente = suscripcionPorAlumno.get(s.alumno_id)
      if (!existente || s.estado === 'activa' || (s.estado === 'pendiente' && existente.estado !== 'activa')) {
        suscripcionPorAlumno.set(s.alumno_id, s)
      }
    }

    // Contar aportes pendientes por alumno
    const { data: aportes } = alumnoIds.length
      ? await admin
          .from('cuotas')
          .select('alumno_id, monto, estado')
          .in('alumno_id', alumnoIds)
          .in('estado', ['pendiente', 'vencida'])
      : { data: [] }

    const pendientesPorAlumno = new Map<string, { cantidad: number; monto: number }>()
    for (const c of (aportes as unknown as { alumno_id: string; monto: number; estado: string }[] | null) ?? []) {
      const cur = pendientesPorAlumno.get(c.alumno_id) ?? { cantidad: 0, monto: 0 }
      cur.cantidad += 1
      cur.monto += c.monto
      pendientesPorAlumno.set(c.alumno_id, cur)
    }

    const rows = lista.map((a) => {
      const s = suscripcionPorAlumno.get(a.id)
      const p = pendientesPorAlumno.get(a.id)
      return {
        nombre_alumno: a.nombre,
        grado: a.grado,
        turno: a.turno ?? '',
        activo: a.activo,
        pagador: a.pagadores?.nombre ?? '',
        pagador_email: a.pagadores?.mail ?? '',
        pagador_telefono: a.pagadores?.telefono ?? '',
        pagador_dni: a.pagadores?.dni ?? '',
        plan: s?.planes?.nombre ?? '',
        modalidad: s?.tipo_pago ?? '',
        metodo_pago: s?.metodo_pago ?? '',
        estado_suscripcion: s?.estado ?? '',
        precio_mensual: s?.planes?.precio_por_mes ?? 0,
        aportes_pendientes: p?.cantidad ?? 0,
        monto_pendiente: p?.monto ?? 0,
        fecha_alta: fechaCorta(a.created_at),
      }
    })

    const buf = await generarExcel({
      hoja: 'Alumnos',
      titulo: 'Listado de alumnos',
      filas: rows,
      columnas: [
        { key: 'nombre_alumno',      label: 'Alumno', ancho: 32 },
        { key: 'grado',              label: 'Grado' },
        { key: 'turno',              label: 'Turno' },
        { key: 'activo',             label: 'Activo' },
        { key: 'pagador',            label: 'Aportante', ancho: 28 },
        { key: 'pagador_email',      label: 'Email aportante', ancho: 28 },
        { key: 'pagador_telefono',   label: 'Teléfono' },
        { key: 'pagador_dni',        label: 'DNI' },
        { key: 'aportes_pendientes', label: 'Aportes pendientes', tipo: 'numero' },
        { key: 'monto_pendiente',    label: 'Monto pendiente', tipo: 'moneda' },
        { key: 'fecha_alta',         label: 'Fecha alta' },
      ],
    })

    return excelResponse(nombreArchivo('alumnos'), buf)
  }

  // ════════════════════════════════════════════════════════════════════
  // 2) PAGADORES
  // ════════════════════════════════════════════════════════════════════
  if (tipo === 'pagadores') {
    const { data: pagadores } = await admin
      .from('pagadores')
      .select('id, nombre, dni, mail, telefono, created_at')
      .order('nombre')

    const lista = (pagadores ?? []) as Array<{
      id: string; nombre: string; dni: string | null; mail: string; telefono: string | null; created_at: string
    }>

    // Total aportado por pagador
    const ids = lista.map((p) => p.id)
    const { data: pagosData } = ids.length
      ? await admin
          .from('pagos')
          .select('pagador_id, monto')
          .in('pagador_id', ids)
          .eq('anulado', false)
      : { data: [] }

    const totalPorPagador = new Map<string, { total: number; cantidad: number }>()
    for (const p of (pagosData as Array<{ pagador_id: string; monto: number }> | null) ?? []) {
      const cur = totalPorPagador.get(p.pagador_id) ?? { total: 0, cantidad: 0 }
      cur.total += p.monto
      cur.cantidad += 1
      totalPorPagador.set(p.pagador_id, cur)
    }

    // Cantidad de alumnos por pagador
    const { data: alumnosData } = ids.length
      ? await admin
          .from('alumnos')
          .select('pagador_id')
          .in('pagador_id', ids)
          .eq('activo', true)
      : { data: [] }

    const alumnosPorPagador = new Map<string, number>()
    for (const a of (alumnosData as Array<{ pagador_id: string }> | null) ?? []) {
      alumnosPorPagador.set(a.pagador_id, (alumnosPorPagador.get(a.pagador_id) ?? 0) + 1)
    }

    const rows = lista.map((p) => {
      const tot = totalPorPagador.get(p.id) ?? { total: 0, cantidad: 0 }
      return {
        nombre: p.nombre,
        dni: p.dni ?? '',
        email: p.mail,
        telefono: p.telefono ?? '',
        cantidad_alumnos: alumnosPorPagador.get(p.id) ?? 0,
        cantidad_aportes_realizados: tot.cantidad,
        total_aportado: tot.total,
        fecha_alta: fechaCorta(p.created_at),
      }
    })

    const buf = await generarExcel({
      hoja: 'Aportantes',
      titulo: 'Listado de aportantes',
      filas: rows,
      columnas: [
        { key: 'nombre',                      label: 'Aportante', ancho: 30 },
        { key: 'dni',                         label: 'DNI' },
        { key: 'email',                       label: 'Email', ancho: 28 },
        { key: 'telefono',                    label: 'Teléfono' },
        { key: 'cantidad_alumnos',            label: 'Alumnos a cargo', tipo: 'numero' },
        { key: 'cantidad_aportes_realizados', label: 'Aportes realizados', tipo: 'numero' },
        { key: 'total_aportado',              label: 'Total aportado', tipo: 'moneda' },
        { key: 'fecha_alta',                  label: 'Fecha alta' },
      ],
    })

    return excelResponse(nombreArchivo('pagadores'), buf)
  }

  // ════════════════════════════════════════════════════════════════════
  // 3) APORTES (cuotas)
  // ════════════════════════════════════════════════════════════════════
  if (tipo === 'aportes') {
    let query = admin
      .from('cuotas')
      .select('*, alumnos(nombre, grado, turno, pagadores(nombre, mail))')
      .order('created_at', { ascending: false })
      .limit(5000)

    if (año) query = query.eq('año', Number(año))
    if (mes) query = query.eq('mes', Number(mes))

    const { data } = await query
    const lista = (data as unknown as (CuotaRow & { año: number })[] | null) ?? []

    const rows = lista.map((c) => ({
      alumno: c.alumnos?.nombre ?? '',
      grado: c.alumnos?.grado ?? '',
      turno: c.alumnos?.turno ?? '',
      pagador: c.alumnos?.pagadores?.nombre ?? '',
      email_pagador: c.alumnos?.pagadores?.mail ?? '',
      periodo: `${NOMBRE_MES[c.mes - 1] ?? c.mes} ${c.año}`,
      mes: c.mes,
      año: c.año,
      monto: c.monto,
      estado: c.estado,
      fecha_creacion: fechaCorta(c.created_at),
    }))

    const buf = await generarExcel({
      hoja: 'Aportes esperados',
      titulo: `Aportes esperados${año ? ` — ${año}` : ''}`,
      filas: rows,
      columnas: [
        { key: 'alumno',         label: 'Alumno', ancho: 32 },
        { key: 'grado',          label: 'Grado' },
        { key: 'turno',          label: 'Turno' },
        { key: 'pagador',        label: 'Aportante', ancho: 28 },
        { key: 'periodo',        label: 'Período' },
        { key: 'monto',          label: 'Monto', tipo: 'moneda' },
        { key: 'estado',         label: 'Estado' },
        { key: 'fecha_creacion', label: 'Generado el' },
      ],
    })

    const sufijo = [año, mes].filter(Boolean).join('-')
    return excelResponse(nombreArchivo('aportes', sufijo), buf)
  }

  // ════════════════════════════════════════════════════════════════════
  // 4) PAGOS
  // ════════════════════════════════════════════════════════════════════
  if (tipo === 'pagos') {
    let query = admin
      .from('pagos')
      .select('*, pagadores(nombre, mail, telefono)')
      .order('fecha', { ascending: false })
      .limit(5000)

    if (año) {
      const y = Number(año)
      query = query.gte('fecha', `${y}-01-01`).lte('fecha', `${y}-12-31`)
    }
    if (mes && año) {
      const m = String(Number(mes)).padStart(2, '0')
      const y = Number(año)
      const ultimoDia = new Date(y, Number(mes), 0).getDate()
      query = query.gte('fecha', `${y}-${m}-01`).lte('fecha', `${y}-${m}-${ultimoDia}`)
    }

    const { data } = await query
    const lista = (data as unknown as PagoRow[] | null) ?? []

    // Para cada pago, traer los aportes asociados (mes/año/alumno)
    const pagoIds = lista.map((p) => p.id)
    type Vinculo = {
      pago_id: string
      cuotas: { mes: number; año: number; alumnos: { nombre: string } | null } | null
    }
    const { data: vinculos } = pagoIds.length
      ? await admin
          .from('pagos_cuotas')
          .select('pago_id, cuotas(mes, año, alumnos(nombre))')
          .in('pago_id', pagoIds)
      : { data: [] }

    const detallePorPago = new Map<string, string[]>()
    for (const v of (vinculos as unknown as Vinculo[] | null) ?? []) {
      if (!v.cuotas) continue
      const periodo = `${NOMBRE_MES[v.cuotas.mes - 1]} ${v.cuotas.año}`
      const alumno = v.cuotas.alumnos?.nombre ?? ''
      const desc = alumno ? `${periodo} (${alumno})` : periodo
      const arr = detallePorPago.get(v.pago_id) ?? []
      arr.push(desc)
      detallePorPago.set(v.pago_id, arr)
    }

    const rows = lista.map((p) => ({
      fecha: fechaCorta(p.fecha),
      pagador: p.pagadores?.nombre ?? '',
      email_pagador: p.pagadores?.mail ?? '',
      monto: p.monto,
      descuento: p.descuento ?? 0,
      metodo: p.metodo,
      registrado_por: p.registrado_por,
      referencia_mp: p.referencia_externa ?? '',
      aportes_cubiertos: (detallePorPago.get(p.id) ?? []).join(' | '),
      notas: p.notas ?? '',
      anulado: p.anulado ? 'SI' : '',
      motivo_anulacion: p.motivo_anulacion ?? '',
      anulado_fecha: p.anulado_at ? fechaCorta(p.anulado_at) : '',
    }))

    const buf = await generarExcel({
      hoja: 'Aportes recibidos',
      titulo: `Aportes recibidos${año ? ` — ${año}` : ''}`,
      filas: rows,
      columnas: [
        { key: 'fecha',             label: 'Fecha' },
        { key: 'pagador',           label: 'Aportante', ancho: 28 },
        { key: 'email_pagador',     label: 'Email aportante', ancho: 26 },
        { key: 'monto',             label: 'Monto', tipo: 'moneda' },
        { key: 'descuento',         label: 'Descuento', tipo: 'moneda' },
        { key: 'metodo',            label: 'Medio de pago' },
        { key: 'aportes_cubiertos', label: 'Aportes cubiertos', ancho: 40 },
        { key: 'referencia_mp',     label: 'Referencia' },
        { key: 'registrado_por',    label: 'Registrado por' },
        { key: 'notas',             label: 'Notas', ancho: 30 },
        { key: 'anulado',           label: 'Anulado' },
        { key: 'motivo_anulacion',  label: 'Motivo anulación', ancho: 30 },
        { key: 'anulado_fecha',     label: 'Fecha anulación' },
      ],
    })

    const sufijo = [año, mes].filter(Boolean).join('-')
    return excelResponse(nombreArchivo('pagos', sufijo), buf)
  }

  return new Response(`Tipo de exportación inválido: ${tipo}`, { status: 400 })
}
