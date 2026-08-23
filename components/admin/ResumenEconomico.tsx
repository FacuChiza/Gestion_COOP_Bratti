import { TrendingUp, Wallet, Clock, Users, CheckCircle2, AlertTriangle } from 'lucide-react'
import { formatMonto } from '@/lib/utils'
import type { ResumenEconomico as Resumen } from '@/app/admin/actions'

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

type Props = {
  data: Resumen
  alumnosActivos: number
  conDeuda: number
}

/**
 * Resumen unificado del panel: reemplaza la vieja franja de stats + el
 * resumen económico (que se pisaban). Dos bloques claros: Dinero y Este mes.
 */
export function ResumenEconomico({ data, alumnosActivos, conDeuda }: Props) {
  const mesNombre = MESES[new Date().getMonth()]
  const totalMes = data.aportesPagadosMes + data.aportesPendientesMes
  const pct = totalMes > 0 ? Math.round((data.aportesPagadosMes / totalMes) * 100) : 0

  return (
    <div className="space-y-5 mb-6">
      {/* ── Dinero ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
          Dinero
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
            tone="neutral"
          />
          <Card
            icon={<Clock className="h-4 w-4" />}
            label="Pendiente de cobro"
            value={formatMonto(data.montoPendiente)}
            sub={`${data.cantPendientes} aporte${data.cantPendientes !== 1 ? 's' : ''} sin pagar`}
            tone="amber"
          />
        </div>
      </section>

      {/* ── Este mes ───────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
          Este mes · {mesNombre}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card
            icon={<Users className="h-4 w-4" />}
            label="Alumnos activos"
            value={String(alumnosActivos)}
            tone="neutral"
          />
          <Card
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Al día este mes"
            value={`${data.aportesPagadosMes} de ${totalMes}`}
            sub={`${pct}% al día`}
            tone="emerald"
            progress={pct}
          />
          <Card
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Con 3+ aportes sin pagar"
            value={String(conDeuda)}
            sub={conDeuda === 0 ? 'ninguno 🎉' : 'requieren seguimiento'}
            tone={conDeuda > 0 ? 'red' : 'neutral'}
          />
        </div>
      </section>
    </div>
  )
}

type Tone = 'emerald' | 'amber' | 'red' | 'neutral'

function Card({
  icon, label, value, sub, tone, progress,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  tone: Tone
  progress?: number
}) {
  const valueCls =
    tone === 'emerald' ? 'text-emerald-600' :
    tone === 'amber'   ? 'text-amber-600'   :
    tone === 'red'     ? 'text-red-600'     : 'text-slate-900'
  const iconCls =
    tone === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
    tone === 'amber'   ? 'bg-amber-50 text-amber-600'     :
    tone === 'red'     ? 'bg-red-50 text-red-600'         : 'bg-slate-100 text-slate-600'

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center justify-center h-7 w-7 rounded-lg shrink-0 ${iconCls}`}>
          {icon}
        </span>
        <span className="text-xs text-slate-500 leading-tight">{label}</span>
      </div>
      <div>
        <p className={`text-2xl font-bold tabular-nums leading-none ${valueCls}`}>{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
      {typeof progress === 'number' && (
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  )
}
