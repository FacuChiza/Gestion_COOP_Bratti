import { getReporteAnual } from '../actions'
import { Logo } from '@/components/Logo'
import { ReportePrintButton } from '@/components/admin/ReportePrintButton'
import { formatMonto } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Reporte anual' }

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const METODO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', mercadopago: 'Mercado Pago', modo: 'MODO', otro: 'Otro',
}

export default async function ReportePage() {
  const r = await getReporteAnual()
  const pctMes = r.totalMes > 0 ? Math.round((r.alDiaMes / r.totalMes) * 100) : 0
  const totalMetodos = r.porMetodo.reduce((s, m) => s + m.total, 0)

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Estilos de impresión: papel A4, ocultar botones, forzar colores */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: A4; margin: 14mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="max-w-3xl mx-auto p-6 sm:p-8">
        <ReportePrintButton />

        {/* Encabezado */}
        <header className="flex items-center justify-between gap-4 border-b-2 border-slate-900 pb-4 mb-6">
          <div className="flex items-center gap-4">
            <Logo size={56} subtitulo={null} />
            <div>
              <h1 className="text-xl font-bold">Reporte de la Cooperadora</h1>
              <p className="text-sm text-slate-500">Escuela Técnica N° 34 Bratti · Ciclo {r.anio}</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 text-right">Generado<br />{r.generado}</p>
        </header>

        {/* Resumen */}
        <section className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">Resumen</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Cell label={`Recaudado ${r.anio}`} value={formatMonto(r.recaudadoAnio)} strong />
            <Cell label="Recaudado este mes" value={formatMonto(r.recaudadoMes)} />
            <Cell label="Pendiente de cobro" value={formatMonto(r.montoPendiente)} sub={`${r.cantPendientes} aportes`} />
            <Cell label="Alumnos activos" value={String(r.alumnosActivos)} />
            <Cell label="Aportantes" value={String(r.aportantes)} />
            <Cell label="Al día este mes" value={`${r.alDiaMes} / ${r.totalMes}`} sub={`${pctMes}%`} />
          </div>
        </section>

        {/* Recaudación por mes */}
        <section className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">Recaudación por mes</h2>
          <table className="w-full text-sm border border-slate-200">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Mes</th>
                <th className="text-right px-3 py-2 font-semibold">Aportes pagados</th>
                <th className="text-right px-3 py-2 font-semibold">Recaudado</th>
              </tr>
            </thead>
            <tbody>
              {r.porMes.map((m) => (
                <tr key={m.mes} className="border-t border-slate-100">
                  <td className="px-3 py-1.5">{MESES[m.mes - 1]}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{m.pagadas}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatMonto(m.recaudado)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 font-bold">
                <td className="px-3 py-2">Total {r.anio}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.porMes.reduce((s, m) => s + m.pagadas, 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMonto(r.recaudadoAnio)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* Por medio de pago */}
        <section className="mb-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">Por medio de pago ({r.anio})</h2>
          {r.porMetodo.length === 0 ? (
            <p className="text-sm text-slate-400">Todavía no hay aportes registrados este año.</p>
          ) : (
            <table className="w-full text-sm border border-slate-200">
              <thead className="bg-slate-100">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Medio</th>
                  <th className="text-right px-3 py-2 font-semibold">Cantidad</th>
                  <th className="text-right px-3 py-2 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {r.porMetodo.map((m) => (
                  <tr key={m.metodo} className="border-t border-slate-100">
                    <td className="px-3 py-1.5">{METODO_LABEL[m.metodo] ?? m.metodo}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{m.cantidad}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatMonto(m.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 font-bold">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.porMetodo.reduce((s, m) => s + m.cantidad, 0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMonto(totalMetodos)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </section>

        <footer className="text-xs text-slate-400 border-t border-slate-200 pt-4 mt-8">
          Cooperadora Escolar Aristides Bratti · Reporte generado automáticamente el {r.generado}.
        </footer>
      </div>
    </div>
  )
}

function Cell({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`tabular-nums ${strong ? 'text-2xl font-bold' : 'text-xl font-semibold'}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  )
}
