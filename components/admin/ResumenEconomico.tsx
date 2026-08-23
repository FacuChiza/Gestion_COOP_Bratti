import { TrendingUp, Wallet, Clock, PiggyBank } from 'lucide-react'
import { formatMonto } from '@/lib/utils'
import type { ResumenEconomico as Resumen } from '@/app/admin/actions'

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export function ResumenEconomico({ data }: { data: Resumen }) {
  const mesNombre = MESES[new Date().getMonth()]
  const totalMes = data.aportesPagadosMes + data.aportesPendientesMes
  const pct = totalMes > 0 ? Math.round((data.aportesPagadosMes / totalMes) * 100) : 0

  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Resumen económico
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card
          icon={<Wallet className="h-4 w-4" />}
          label={`Recaudado en ${mesNombre}`}
          value={formatMonto(data.recaudadoMes)}
          tone="emerald"
        />
        <Card
          icon={<TrendingUp className="h-4 w-4" />}
          label={`Recaudado en ${data.anio}`}
          value={formatMonto(data.recaudadoAnio)}
          tone="slate"
        />
        <Card
          icon={<Clock className="h-4 w-4" />}
          label="Pendiente de cobro"
          value={formatMonto(data.montoPendiente)}
          sub={`${data.cantPendientes} aporte${data.cantPendientes !== 1 ? 's' : ''} sin pagar`}
          tone="amber"
        />
        <Card
          icon={<PiggyBank className="h-4 w-4" />}
          label={`Aportes de ${mesNombre}`}
          value={`${data.aportesPagadosMes} / ${totalMes}`}
          sub={`${pct}% al día`}
          tone="slate"
          progress={pct}
        />
      </div>
    </div>
  )
}

function Card({
  icon, label, value, sub, tone, progress,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  tone: 'emerald' | 'amber' | 'slate'
  progress?: number
}) {
  const toneCls =
    tone === 'emerald' ? 'text-emerald-600' :
    tone === 'amber'   ? 'text-amber-600'   : 'text-slate-900'
  const iconBg =
    tone === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
    tone === 'amber'   ? 'bg-amber-50 text-amber-600'     : 'bg-slate-100 text-slate-600'

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex items-center justify-center h-7 w-7 rounded-lg ${iconBg}`}>
          {icon}
        </span>
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${toneCls}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      {typeof progress === 'number' && (
        <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}
