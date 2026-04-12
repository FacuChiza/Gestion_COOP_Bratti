import { CheckCircle2, Clock, AlertCircle, MinusCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatMes, formatMonto } from '@/lib/utils'
import type { Cuota } from '@/types'

type SuscripcionConPlan = {
  id: string
  estado: string
  planes?: { nombre: string; precio_por_mes: number } | null
}

type Alumno = {
  id: string
  nombre: string
  grado: string
  turno: string | null
  cuota_actual: Cuota | null
  cuotas_deuda: number
  suscripcion_activa: SuscripcionConPlan | null
  historial: Cuota[]
}

type Props = {
  alumno: Alumno
}

function CuotaStatusIcon({ estado }: { estado: string | undefined }) {
  if (estado === 'pagada') return <CheckCircle2 className="h-5 w-5 text-emerald-500" />
  if (estado === 'vencida') return <AlertCircle className="h-5 w-5 text-red-500" />
  if (estado === 'pendiente') return <Clock className="h-5 w-5 text-amber-500" />
  return <MinusCircle className="h-5 w-5 text-slate-300" />
}

export function StudentCard({ alumno }: Props) {
  const ahora = new Date()
  const mesActual = ahora.getMonth() + 1
  const añoActual = ahora.getFullYear()

  const estadoActual = alumno.cuota_actual?.estado

  const borderColor =
    estadoActual === 'pagada' ? 'border-emerald-200' :
    estadoActual === 'vencida' ? 'border-red-200' :
    estadoActual === 'pendiente' ? 'border-amber-200' :
    'border-slate-200'

  const bgColor =
    estadoActual === 'pagada' ? 'bg-emerald-50' :
    estadoActual === 'vencida' ? 'bg-red-50' :
    estadoActual === 'pendiente' ? 'bg-amber-50' :
    'bg-slate-50'

  return (
    <Card className={`${borderColor} overflow-hidden`}>
      {/* Estado actual destacado */}
      <div className={`${bgColor} px-5 py-4 border-b ${borderColor} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <CuotaStatusIcon estado={estadoActual} />
          <div>
            <p className="text-xs text-slate-500">{formatMes(mesActual, añoActual)}</p>
            <p className="font-semibold capitalize">
              {estadoActual ?? 'Sin cuota generada'}
            </p>
          </div>
        </div>
        {alumno.cuota_actual && (
          <p className="text-lg font-bold">{formatMonto(alumno.cuota_actual.monto)}</p>
        )}
      </div>

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">{alumno.nombre}</CardTitle>
          {alumno.cuotas_deuda > 0 && (
            <Badge variant="danger">{alumno.cuotas_deuda} en deuda</Badge>
          )}
        </div>
        <p className="text-xs text-slate-500">
          {alumno.grado}{alumno.turno ? ` · ${alumno.turno}` : ''}
          {alumno.suscripcion_activa?.planes && (
            <> · Plan {alumno.suscripcion_activa.planes.nombre}</>
          )}
        </p>
      </CardHeader>

      {/* Historial de los últimos meses */}
      <CardContent>
        {alumno.historial.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-slate-400 mb-2">Últimas cuotas</p>
            <div className="space-y-1">
              {alumno.historial.slice(0, 6).map((cuota) => (
                <div key={cuota.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <CuotaStatusIcon estado={cuota.estado} />
                    <span className="text-slate-600">{formatMes(cuota.mes, cuota.año)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        cuota.estado === 'pagada' ? 'text-emerald-600' :
                        cuota.estado === 'vencida' ? 'text-red-600' :
                        'text-amber-600'
                      }
                    >
                      {formatMonto(cuota.monto)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No hay historial de cuotas</p>
        )}
      </CardContent>
    </Card>
  )
}
