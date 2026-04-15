/**
 * /pagar
 *
 * Dos modos:
 *   ?alumno=<id>  → pagar cuotas de un alumno específico
 *   ?todo=1       → pagar todas las cuotas pendientes de todos los alumnos
 *
 * Flujo: verifica sesión → obtiene cuotas → crea preferencia MP → muestra confirmación
 */

import { redirect } from 'next/navigation'
import { ArrowRight, CreditCard, AlertCircle, School, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { crearPreferenciaMP, mpConfigurado } from '@/lib/mp'
import { formatMonto, formatMes } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// ─── Tipos locales ────────────────────────────────────────────────────────────

type CuotaConAlumno = {
  id: string
  mes: number
  año: number
  monto: number
  estado: string
  suscripcion_id: string
  alumno_nombre?: string
}

// ─── Componentes de UI ───────────────────────────────────────────────────────

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="h-9 w-9 rounded-xl bg-slate-900 flex items-center justify-center">
            <School className="h-5 w-5 text-white" />
          </div>
          <span className="font-semibold text-slate-900">Cooperadora</span>
        </div>
        {children}
      </div>
    </div>
  )
}

function ErrorCard({ titulo, mensaje }: { titulo: string; mensaje: string }) {
  return (
    <Layout>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 text-center">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>
        </div>
        <div>
          <p className="font-semibold text-slate-900">{titulo}</p>
          <p className="text-sm text-slate-500 mt-1">{mensaje}</p>
        </div>
        <a
          href="/cuenta/dashboard"
          className="inline-flex items-center justify-center h-9 px-5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition-colors"
        >
          Volver al inicio
        </a>
      </div>
    </Layout>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default async function PagarPage({
  searchParams,
}: {
  searchParams: { alumno?: string; todo?: string }
}) {
  const modoTodo = searchParams.todo === '1'

  if (!searchParams.alumno && !modoTodo) redirect('/cuenta/dashboard')

  // ── Verificar sesión ──────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/cuenta')

  // ── Buscar pagador ────────────────────────────────────────────
  const { data: pagador } = await supabase
    .from('pagadores')
    .select('id, nombre, mail')
    .eq('mail', user.email!)
    .maybeSingle()

  if (!pagador) redirect('/cuenta/dashboard')

  const admin = createAdminClient()

  // ── Obtener alumnos del pagador ───────────────────────────────
  const { data: alumnos } = await supabase
    .from('alumnos')
    .select('id, nombre, suscripciones(id, estado, tipo_pago)')
    .eq('pagador_id', pagador.id)
    .eq('activo', true)

  if (!alumnos?.length) redirect('/cuenta/dashboard')

  // ── Filtrar alumnos según modo ────────────────────────────────
  const alumnosFiltrados = modoTodo
    ? alumnos
    : alumnos.filter((a) => a.id === searchParams.alumno)

  if (!alumnosFiltrados.length) {
    return (
      <ErrorCard
        titulo="Alumno no encontrado"
        mensaje="No encontramos ese/a estudiante en tu cuenta."
      />
    )
  }

  // ── Obtener cuotas pendientes de los alumnos seleccionados ────
  const cuotasPromises = alumnosFiltrados.map(async (alumno) => {
    const { data } = await admin
      .from('cuotas')
      .select('*')
      .eq('alumno_id', alumno.id)
      .in('estado', ['pendiente', 'vencida'])
      .order('año', { ascending: true })
      .order('mes', { ascending: true })

    return (data ?? []).map((c) => ({
      ...(c as { id: string; mes: number; año: number; monto: number; estado: string; suscripcion_id: string }),
      alumno_nombre: alumno.nombre,
    }))
  })

  const cuotasPorAlumno = await Promise.all(cuotasPromises)
  const todasLasCuotas: CuotaConAlumno[] = cuotasPorAlumno.flat()

  if (todasLasCuotas.length === 0) redirect('/cuenta/dashboard')

  const montoTotal = todasLasCuotas.reduce((acc, c) => acc + c.monto, 0)

  // ── Verificar MP ──────────────────────────────────────────────
  if (!mpConfigurado()) {
    return (
      <ErrorCard
        titulo="Pago online no disponible"
        mensaje="El pago online no está habilitado todavía. Acercate a la cooperadora."
      />
    )
  }

  // ── Crear preferencia en MP ───────────────────────────────────
  // Referencia: para 1 alumno usamos su suscripción; para "todo" usamos el pagador
  let tituloMP: string
  let referenciaMP: string
  let tipoMP: 'manual' | 'anual'

  if (modoTodo) {
    const cantAlumnos = alumnosFiltrados.length
    const cantCuotas  = todasLasCuotas.length
    tituloMP    = `${cantCuotas} cuota${cantCuotas > 1 ? 's' : ''} — ${cantAlumnos} estudiante${cantAlumnos > 1 ? 's' : ''}`
    referenciaMP = `pagador:${pagador.id}`
    tipoMP      = 'manual'
  } else {
    const alumno = alumnosFiltrados[0]
    const suscripcionActiva = (
      alumno.suscripciones as Array<{ id: string; estado: string; tipo_pago: string }>
    )?.find((s) => ['activa', 'pendiente'].includes(s.estado))

    if (!suscripcionActiva) {
      return (
        <ErrorCard
          titulo="Sin suscripción activa"
          mensaje="No hay una suscripción activa para este/a estudiante. Contactá a la cooperadora."
        />
      )
    }

    const cantCuotas = todasLasCuotas.length
    tituloMP    = `${cantCuotas} cuota${cantCuotas > 1 ? 's' : ''} — ${alumno.nombre}`
    referenciaMP = suscripcionActiva.id
    tipoMP      = 'manual'
  }

  const mpData = await crearPreferenciaMP({
    titulo:       tituloMP,
    monto:        montoTotal,
    pagadorEmail: pagador.mail,
    referencia:   referenciaMP,
    tipo:         tipoMP,
  })

  if (!mpData) {
    return (
      <ErrorCard
        titulo="Error al conectar con MercadoPago"
        mensaje="No se pudo iniciar el pago. Intentá de nuevo en unos minutos."
      />
    )
  }

  const checkoutUrl =
    process.env.NODE_ENV === 'production'
      ? mpData.init_point
      : mpData.sandbox_init_point

  // ── Agrupar cuotas por alumno para mostrar en UI ──────────────
  const cuotasPorAlumnoUI = alumnosFiltrados
    .map((alumno) => ({
      nombre: alumno.nombre,
      cuotas: todasLasCuotas.filter((c) => c.alumno_nombre === alumno.nombre),
    }))
    .filter((a) => a.cuotas.length > 0)

  const multipleAlumnos = cuotasPorAlumnoUI.length > 1

  return (
    <Layout>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
              {multipleAlumnos
                ? <Users className="h-5 w-5 text-white" />
                : <CreditCard className="h-5 w-5 text-white" />
              }
            </div>
            <div>
              <p className="font-semibold">Pagar con MercadoPago</p>
              <p className="text-sm text-white/70">
                {multipleAlumnos
                  ? `${cuotasPorAlumnoUI.length} estudiantes`
                  : cuotasPorAlumnoUI[0]?.nombre
                }
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Detalle de cuotas por alumno */}
          <div className="space-y-3">
            {cuotasPorAlumnoUI.map((grupo) => (
              <div key={grupo.nombre}>
                {multipleAlumnos && (
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    {grupo.nombre}
                  </p>
                )}
                <div className="rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                  {grupo.cuotas.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between px-4 py-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${
                            c.estado === 'vencida' ? 'bg-red-400' : 'bg-amber-400'
                          }`}
                        />
                        <span className="text-sm text-slate-700">
                          {formatMes(c.mes, c.año)}
                        </span>
                        {c.estado === 'vencida' && (
                          <span className="text-xs text-red-500 font-medium">vencida</span>
                        )}
                      </div>
                      <span className="text-sm font-medium text-slate-900">
                        {formatMonto(c.monto)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl">
            <span className="font-semibold text-slate-700">Total</span>
            <span className="text-xl font-bold text-slate-900">
              {formatMonto(montoTotal)}
            </span>
          </div>

          {/* Botón MP */}
          <a
            href={checkoutUrl}
            className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-[#009EE3] hover:bg-[#0082BF] text-white font-semibold text-sm transition-colors"
          >
            Ir a MercadoPago
            <ArrowRight className="h-4 w-4" />
          </a>

          <p className="text-center text-xs text-slate-400">
            Serás redirigido/a al sitio seguro de MercadoPago
          </p>

          <a
            href="/cuenta/dashboard"
            className="block text-center text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Cancelar
          </a>
        </div>
      </div>
    </Layout>
  )
}
