/**
 * /aporte/[pagadorId]
 *
 * PÁGINA PÚBLICA — sin login.
 * Se accede desde el QR/link que reparte la cooperadora.
 *
 * Comportamiento:
 *  - Si tiene aportes pendientes/vencidos → los lista y ofrece pagar todo junto
 *  - Si está al día → ofrece colaborar con el monto del próximo mes (proactivo)
 *  - Después del pago, MP devuelve a esta misma URL con ?pago=ok|error|pendiente
 */

import { notFound } from 'next/navigation'
import { CheckCircle2, AlertCircle, Clock, School, ArrowRight, Heart } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { crearPreferenciaMP, mpConfigurado } from '@/lib/mp'
import { formatMonto, formatMes } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Pagador = { id: string; nombre: string; mail: string }
type Alumno  = { id: string; nombre: string; grado: string; turno: string | null }
type Cuota   = { id: string; mes: number; año: number; monto: number; estado: string; alumno_id: string }
type Plan    = { precio_por_mes: number; nombre: string }
type Suscripcion = { id: string; alumno_id: string; estado: string; planes: Plan | null }

// ─── Layout reutilizable ──────────────────────────────────────────────────────

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-5">
          <div className="h-9 w-9 rounded-xl bg-slate-900 flex items-center justify-center">
            <School className="h-5 w-5 text-white" />
          </div>
          <span className="font-semibold text-slate-900">Cooperadora Escolar</span>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default async function AporteExpressPage({
  params,
  searchParams,
}: {
  params: { pagadorId: string }
  searchParams: { pago?: string }
}) {
  const admin = createAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const backUrl = `${appUrl}/aporte/${params.pagadorId}`

  // ── Buscar pagador ─────────────────────────────────────────────
  const { data: pagador } = await admin
    .from('pagadores')
    .select('id, nombre, mail')
    .eq('id', params.pagadorId)
    .maybeSingle()

  if (!pagador) notFound()

  const p = pagador as Pagador

  // ── Banner según resultado del pago ────────────────────────────
  const banner = searchParams.pago

  if (banner === 'ok') {
    return (
      <Layout>
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
          </div>
          <div>
            <p className="font-bold text-slate-900 text-lg">¡Gracias por colaborar! 💚</p>
            <p className="text-sm text-slate-500 mt-1">
              Tu aporte fue procesado correctamente.<br />
              En unos minutos te llega el comprobante por email.
            </p>
          </div>
          <a
            href={backUrl}
            className="inline-flex items-center justify-center text-sm text-slate-500 hover:text-slate-700"
          >
            Volver
          </a>
        </div>
      </Layout>
    )
  }

  if (banner === 'pendiente') {
    return (
      <Layout>
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-6 text-center space-y-4">
          <Clock className="h-12 w-12 text-amber-500 mx-auto" />
          <p className="font-semibold text-slate-900">Aporte en proceso</p>
          <p className="text-sm text-slate-500">
            MercadoPago está confirmando tu pago. Te avisaremos por email apenas se confirme.
          </p>
          <a href={backUrl} className="text-sm text-slate-500 hover:text-slate-700">
            Volver
          </a>
        </div>
      </Layout>
    )
  }

  if (banner === 'error') {
    return (
      <Layout>
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6 text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <p className="font-semibold text-slate-900">El pago no se completó</p>
          <p className="text-sm text-slate-500">
            Podés intentarlo nuevamente.
          </p>
          <a
            href={backUrl}
            className="inline-flex h-9 px-5 items-center justify-center rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700"
          >
            Reintentar
          </a>
        </div>
      </Layout>
    )
  }

  // ── Flujo normal: cargar alumnos + aportes ─────────────────────
  if (!mpConfigurado()) {
    return (
      <Layout>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center space-y-3">
          <p className="font-semibold text-slate-900">Pago online no disponible</p>
          <p className="text-sm text-slate-500">
            Acercate a la cooperadora para colaborar en efectivo.
          </p>
        </div>
      </Layout>
    )
  }

  const { data: alumnosData } = await admin
    .from('alumnos')
    .select('id, nombre, grado, turno')
    .eq('pagador_id', p.id)
    .eq('activo', true)
    .order('nombre')

  const alumnos = (alumnosData as Alumno[] | null) ?? []

  if (alumnos.length === 0) {
    return (
      <Layout>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center space-y-3">
          <p className="font-semibold text-slate-900">No encontramos estudiantes</p>
          <p className="text-sm text-slate-500">
            No hay estudiantes activos asociados a este link.
            Contactá a la cooperadora.
          </p>
        </div>
      </Layout>
    )
  }

  const alumnoIds = alumnos.map((a) => a.id)

  // Aportes pendientes
  const { data: aportesData } = await admin
    .from('cuotas')
    .select('*')
    .in('alumno_id', alumnoIds)
    .in('estado', ['pendiente', 'vencida'])
    .order('año', { ascending: true })
    .order('mes', { ascending: true })

  const aportes = (aportesData as unknown as Cuota[] | null) ?? []

  // Suscripciones (para tener el plan / monto mensual)
  const { data: suscData } = await admin
    .from('suscripciones')
    .select('id, alumno_id, estado, planes(precio_por_mes, nombre)')
    .in('alumno_id', alumnoIds)
    .in('estado', ['activa', 'pendiente'])

  const suscripciones = (suscData as unknown as Suscripcion[] | null) ?? []

  // Determinar qué cobrar
  const tienePendientes = aportes.length > 0
  const montoTotal = tienePendientes
    ? aportes.reduce((acc, c) => acc + c.monto, 0)
    : suscripciones.reduce((acc, s) => acc + (s.planes?.precio_por_mes ?? 0), 0)

  // Si no hay nada para cobrar (sin suscripciones tampoco) → mostrar mensaje neutro
  if (!tienePendientes && montoTotal === 0) {
    return (
      <Layout>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
          <p className="font-semibold text-slate-900">Estás al día 💚</p>
          <p className="text-sm text-slate-500">
            No hay aportes pendientes en este momento. ¡Gracias por colaborar!
          </p>
        </div>
      </Layout>
    )
  }

  // Crear preferencia de pago
  const titulo = tienePendientes
    ? `${aportes.length} aporte${aportes.length > 1 ? 's' : ''} pendiente${aportes.length > 1 ? 's' : ''}`
    : `Aporte mensual — ${alumnos.length} estudiante${alumnos.length > 1 ? 's' : ''}`

  const mpData = await crearPreferenciaMP({
    titulo,
    monto: montoTotal,
    pagadorEmail: p.mail,
    referencia: p.id,
    tipo: 'pagador',
    backUrlBase: backUrl,
  })

  if (!mpData) {
    return (
      <Layout>
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6 text-center space-y-3">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <p className="font-semibold text-slate-900">Error al conectar con MercadoPago</p>
          <p className="text-sm text-slate-500">Intentá de nuevo en unos minutos.</p>
        </div>
      </Layout>
    )
  }

  const checkoutUrl = process.env.NODE_ENV === 'production'
    ? mpData.init_point
    : mpData.sandbox_init_point

  const nombresAlumnos = alumnos.map((a) => a.nombre).join(', ')

  return (
    <Layout>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Header con saludo */}
        <div className="bg-slate-900 px-6 py-5 text-white">
          <p className="text-sm text-white/70">Hola</p>
          <p className="font-semibold text-lg">{p.nombre.split(' ')[0]} 👋</p>
        </div>

        <div className="p-6 space-y-5">

          {tienePendientes ? (
            <>
              {/* Detalle de pendientes */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Aportes pendientes — {nombresAlumnos}
                </p>
                <div className="rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                  {aportes.map((c) => {
                    const alumno = alumnos.find((a) => a.id === c.alumno_id)
                    return (
                      <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${
                              c.estado === 'vencida' ? 'bg-red-400' : 'bg-amber-400'
                            }`}
                          />
                          <div>
                            <p className="text-sm text-slate-700">{formatMes(c.mes, c.año)}</p>
                            {alumnos.length > 1 && alumno && (
                              <p className="text-xs text-slate-400">{alumno.nombre}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-medium text-slate-900">
                          {formatMonto(c.monto)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Modo proactivo: aporte del próximo mes */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 flex items-center gap-3">
                <Heart className="h-5 w-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-900">
                    Estás al día — gracias 💚
                  </p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Si querés, podés adelantar el aporte mensual.
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Aporte mensual — {nombresAlumnos}
                </p>
                <div className="rounded-xl border border-slate-100 px-4 py-3">
                  <p className="text-sm text-slate-600">
                    {alumnos.length === 1
                      ? `Aporte sugerido para ${alumnos[0].nombre}`
                      : `Aporte sugerido para ${alumnos.length} estudiantes`}
                  </p>
                </div>
              </div>
            </>
          )}

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
            className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-[#009EE3] hover:bg-[#0082BF] text-white font-semibold transition-colors"
          >
            Colaborar con MercadoPago
            <ArrowRight className="h-4 w-4" />
          </a>

          <p className="text-center text-xs text-slate-400">
            🔒 Vas a ser redirigido al sitio seguro de MercadoPago.<br />
            Tu aporte es voluntario y agradecido.
          </p>
        </div>
      </div>

      <p className="text-center text-xs text-slate-400 mt-4">
        Cooperadora Escolar Aristides Bratti
      </p>
    </Layout>
  )
}
