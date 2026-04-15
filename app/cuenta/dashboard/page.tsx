import { redirect } from 'next/navigation'
import { LogOut, School, CheckCircle2, Clock, AlertCircle, CreditCard, Wallet, Minus } from 'lucide-react'
import { getDashboardData, logoutAction } from '@/app/cuenta/actions'
import { PaymentHistory } from '@/components/cuenta/PaymentHistory'
import { DashboardClient } from '@/components/cuenta/DashboardClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatMonto, formatMes } from '@/lib/utils'
import { mpConfigurado } from '@/lib/mp'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const data = await getDashboardData()
  if (!data) redirect('/cuenta')

  if (!data.pagador) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="text-center space-y-3">
          <p className="text-slate-600">Tu usuario no tiene un pagador asociado.</p>
          <p className="text-sm text-slate-400">Contactá a la cooperadora para que te den de alta.</p>
          <form action={logoutAction}>
            <Button variant="outline" type="submit">Cerrar sesión</Button>
          </form>
        </div>
      </div>
    )
  }

  const { pagador, alumnos } = data
  const mpActivo = mpConfigurado()

  const ahora = new Date()
  const mesActual = ahora.getMonth() + 1
  const añoActual = ahora.getFullYear()

  // Deuda total de todos los alumnos
  const totalDeuda = alumnos.reduce((acc: number, a) => {
    const deuda = (a.historial as Array<{ estado: string; monto: number }>)
      .filter(c => c.estado === 'pendiente' || c.estado === 'vencida')
      .reduce((s, c) => s + c.monto, 0)
    return acc + deuda
  }, 0)

  const todosAlDia = totalDeuda === 0

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center">
              <School className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm leading-tight">Cooperadora</p>
              <p className="text-xs text-slate-500 leading-tight">Hola, {pagador.nombre.split(' ')[0]}</p>
            </div>
          </div>
          <form action={logoutAction}>
            <Button variant="ghost" size="sm" type="submit" className="gap-1.5 text-slate-500 text-xs">
              <LogOut className="h-3.5 w-3.5" />
              Salir
            </Button>
          </form>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* Banner estado general */}
        {todosAlDia ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            <div>
              <p className="font-semibold text-emerald-800 text-sm">Estás al día 🎉</p>
              <p className="text-xs text-emerald-600">No tenés cuotas pendientes. ¡Gracias!</p>
            </div>
          </div>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                <div>
                  <p className="font-semibold text-red-800 text-sm">Tenés cuotas sin pagar</p>
                  <p className="text-xs text-red-600">Acercate a la cooperadora o pagá online.</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-red-400">Total</p>
                <p className="font-bold text-red-700">{formatMonto(totalDeuda)}</p>
              </div>
            </div>
            {mpActivo && (
              <Button className="w-full gap-2 bg-red-700 hover:bg-red-800" asChild>
                <a href="/pagar?todo=1">
                  <CreditCard className="h-4 w-4" />
                  Pagar todo — {formatMonto(totalDeuda)}
                </a>
              </Button>
            )}
          </div>
        )}

        {/* Encabezado mis estudiantes + banners de resultado de pago */}
        <DashboardClient cantidadAlumnos={alumnos.length} />

        {/* Tarjeta por cada alumno */}
        {alumnos.map((alumno) => {
          const cuotaActual = alumno.cuota_actual as { estado: string; monto: number } | null
          const cuotasDeuda = alumno.cuotas_deuda as number
          const historial = alumno.historial as Array<{ id: string; mes: number; año: number; monto: number; estado: string }>
          const suscripcion = alumno.suscripcion_activa as {
            tipo_pago?: string
            mp_status?: string
            estado?: string
            planes?: { nombre: string }
          } | null

          const tipoPago = suscripcion?.tipo_pago ?? 'manual'
          const estadoActual = cuotaActual?.estado

          return (
            <Card key={alumno.id} className="overflow-hidden">
              {/* Cabecera del alumno */}
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{alumno.nombre}</CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {alumno.grado}{alumno.turno ? ` · Turno ${alumno.turno}` : ''}
                    </p>
                  </div>
                  {tipoPago === 'suscripcion' ? (
                    suscripcion?.mp_status === 'activa'
                      ? <Badge variant="success">Débito automático ✓</Badge>
                      : <Badge variant="warning">Suscripción pendiente</Badge>
                  ) : tipoPago === 'anual' ? (
                    <Badge variant="secondary">Pago anual</Badge>
                  ) : (
                    <Badge variant="secondary">Pago mensual</Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                {/* Estado del mes actual */}
                <div className={`rounded-lg px-4 py-3 flex items-center justify-between ${
                  estadoActual === 'pagada'   ? 'bg-emerald-50 border border-emerald-100' :
                  estadoActual === 'vencida'  ? 'bg-red-50 border border-red-100'         :
                  estadoActual === 'pendiente'? 'bg-amber-50 border border-amber-100'      :
                  'bg-slate-50 border border-slate-100'
                }`}>
                  <div className="flex items-center gap-2">
                    {estadoActual === 'pagada'
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      : estadoActual === 'vencida'
                      ? <AlertCircle  className="h-4 w-4 text-red-500" />
                      : estadoActual === 'pendiente'
                      ? <Clock        className="h-4 w-4 text-amber-500" />
                      : <Minus        className="h-4 w-4 text-slate-400" />
                    }
                    <div>
                      <p className="text-xs text-slate-500">{formatMes(mesActual, añoActual)}</p>
                      <p className={`text-sm font-semibold capitalize ${
                        estadoActual === 'pagada'    ? 'text-emerald-700' :
                        estadoActual === 'vencida'   ? 'text-red-700'     :
                        estadoActual === 'pendiente' ? 'text-amber-700'   : 'text-slate-500'
                      }`}>
                        {estadoActual ?? 'Sin cuota generada'}
                      </p>
                    </div>
                  </div>
                  {cuotaActual && (
                    <span className="font-bold text-slate-800">
                      {formatMonto(cuotaActual.monto)}
                    </span>
                  )}
                </div>

                {/* Botón de pago (visible si hay deuda y MP está activo) */}
                {cuotasDeuda > 0 && (
                  <div className="space-y-2">
                    {mpActivo ? (
                      <Button className="w-full gap-2" asChild>
                        <a href={`/pagar?alumno=${alumno.id}`}>
                          <CreditCard className="h-4 w-4" />
                          Pagar {cuotasDeuda} cuota{cuotasDeuda > 1 ? 's' : ''} — {formatMonto(
                            historial
                              .filter(c => c.estado === 'pendiente' || c.estado === 'vencida')
                              .reduce((acc, c) => acc + c.monto, 0)
                          )}
                        </a>
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                        <Wallet className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          Tenés <strong>{cuotasDeuda}</strong> cuota{cuotasDeuda > 1 ? 's' : ''} pendiente{cuotasDeuda > 1 ? 's' : ''}.
                          El pago online estará disponible pronto. Mientras tanto, acercate a la cooperadora.
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Historial */}
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                    Historial
                  </p>
                  <PaymentHistory cuotas={historial.slice(0, 8)} />
                </div>
              </CardContent>
            </Card>
          )
        })}

        {/* Info de contacto */}
        <p className="text-center text-xs text-slate-400 pb-4">
          ¿Consultas? Acercate a la cooperadora de la escuela.
        </p>
      </main>
    </div>
  )
}
