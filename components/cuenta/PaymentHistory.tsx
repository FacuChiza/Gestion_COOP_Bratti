import { CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { formatMes, formatMonto } from '@/lib/utils'

type CuotaMinima = {
  id: string
  mes: number
  año: number
  monto: number
  estado: string
}

type Props = {
  cuotas: CuotaMinima[]
}

const iconEstado = (estado: string) => {
  if (estado === 'pagada')   return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
  if (estado === 'vencida')  return <AlertCircle  className="h-4 w-4 text-red-500 shrink-0" />
  return                            <Clock        className="h-4 w-4 text-amber-500 shrink-0" />
}

const labelEstado: Record<string, string> = {
  pagada:    'Pagada',
  pendiente: 'Pendiente',
  vencida:   'Vencida',
}

export function PaymentHistory({ cuotas }: Props) {
  if (cuotas.length === 0) {
    return <p className="text-sm text-slate-400 py-4 text-center">Sin historial de cuotas aún.</p>
  }

  return (
    <div className="divide-y divide-slate-100">
      {cuotas.map((cuota) => (
        <div key={cuota.id} className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            {iconEstado(cuota.estado)}
            <div>
              <p className="text-sm font-medium text-slate-800">
                {formatMes(cuota.mes, cuota.año)}
              </p>
              <p className={`text-xs ${
                cuota.estado === 'pagada'   ? 'text-emerald-600' :
                cuota.estado === 'vencida' ? 'text-red-500'     : 'text-amber-600'
              }`}>
                {labelEstado[cuota.estado]}
              </p>
            </div>
          </div>
          <span className="text-sm font-semibold text-slate-800">
            {formatMonto(cuota.monto)}
          </span>
        </div>
      ))}
    </div>
  )
}
