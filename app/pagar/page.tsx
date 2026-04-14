/**
 * /pagar?alumno=<alumno_id>
 *
 * Página de paso intermedio:
 * 1. Verifica que el usuario esté autenticado y sea dueño del alumno
 * 2. Crea una preferencia de pago en MercadoPago con el total de cuotas pendientes
 * 3. Redirige al checkout de MP
 */

import { redirect } from 'next/navigation'
import { ArrowRight, CreditCard, AlertCircle, School } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { crearPreferenciaMP, mpConfigurado } from '@/lib/mp'
import { formatMonto, formatMes } from '@/lib/utils'

export const dynamic = 'force-dynamic'

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

// ─── Página principal ────────────────────────────────────────────────────────

export default async function PagarPage({
  searchParams,
}: {
  searchParams: { alumno?: string }
}) {
  // 1. Validar parámetro
  if (!searchParams.alumno) redirect('/cuenta/dashboard')

  // 2. Verificar sesión
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/cuenta')

  // 3. Buscar pagador
  const { data: pagador } = await supabase
    .from('pagadores')
    .select('id, nombre, mail')
    .eq('mail', user.email!)
    .maybeSingle()

  if (!pagador) redirect('/cuenta/dashboard')

  // 4. Verificar que el alumno pertenece al pagador
  const { data: alumno } = await supabase
    .from('alumnos')
    .select('id, nombre, grado, turno, suscripciones(id, estado, tipo_pago)')
    .eq('id', searchParams.alumno)
    .eq('pagador_id', pagador.id)
    .single()

  if (!alumno) {
    return (
      <ErrorCard
        titulo="Alumno no encontrado"
        mensaje="No encontramos ese/a estudiante en tu cuenta."
      />
    )
  }

  // 5. Traer cuotas pendientes / vencidas
  const admin = createAdminClient()
  const { data: rawCuotas } = await admin
    .from('cuotas')
    .select('*')
    .eq('alumno_id', alumno.id)
    .in('estado', ['pendiente', 'vencida'])
    .order('año', { ascending: true })
    .order('mes', { ascending: true })

  type Cuota = { id: string; mes: number; año: number; monto: number; estado: string }
  const cuotas = rawCuotas as Cuota[] | null

  if (!cuotas || cuotas.length === 0) redirect('/cuenta/dashboard')

  const montoTotal = cuotas.reduce((acc, c) => acc + c.monto, 0)

  // 6. Verificar que MP esté configurado
  if (!mpConfigurado()) {
    return (
      <ErrorCard
        titulo="Pago online no disponible"
        mensaje="El pago online no está habilitado todavía. Acercate a la cooperadora."
      />
    )
  }

  // 7. Obtener suscripción activa para usar como referencia en el webhook
  const suscripcionActiva = (
    alumno.suscripciones as Array<{ id: string; estado: string; tipo_pago: string }>
  )?.find((s) => s.estado === 'activa')

  if (!suscripcionActiva) {
    return (
      <ErrorCard
        titulo="Sin suscripción activa"
        mensaje="No hay una suscripción activa. Contactá a la cooperadora."
      />
    )
  }

  // 8. Construir título descriptivo
  const titulo =
    cuotas.length === 1
      ? `${formatMes(cuotas[0].mes, cuotas[0].año)} — ${alumno.nombre}`
      : `${cuotas.length} cuotas — ${alumno.nombre}`

  // 9. Crear preferencia en MP
  const mpData = await crearPreferenciaMP({
    titulo,
    monto: montoTotal,
    pagadorEmail: pagador.mail,
    referencia: suscripcionActiva.id,
    tipo: 'manual',
  })

  if (!mpData) {
    return (
      <ErrorCard
        titulo="Error al conectar con MercadoPago"
        mensaje="No se pudo iniciar el pago. Intentá de nuevo en unos minutos."
      />
    )
  }

  // 10. En dev: sandbox_init_point / En prod: init_point
  const checkoutUrl =
    process.env.NODE_ENV === 'production'
      ? mpData.init_point
      : mpData.sandbox_init_point

  // 11. Mostrar pantalla de confirmación antes de redirigir
  //     (mejor UX que redirigir directamente sin avisar)
  return (
    <Layout>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-semibold">Pagar con MercadoPago</p>
              <p className="text-sm text-white/70">{alumno.nombre}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Detalle de cuotas */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Cuotas a pagar
            </p>
            <div className="rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
              {cuotas.map((c) => (
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
                  </div>
                  <span className="text-sm font-medium text-slate-900">
                    {formatMonto(c.monto)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl">
            <span className="font-semibold text-slate-700">Total</span>
            <span className="text-xl font-bold text-slate-900">
              {formatMonto(montoTotal)}
            </span>
          </div>

          {/* Botón ir a MP */}
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
