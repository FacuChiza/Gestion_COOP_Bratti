'use client'

import { useEffect, useState, useCallback } from 'react'
import { Ban, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatMes, formatMonto } from '@/lib/utils'
import { getPagosRecientes } from '@/app/admin/actions'
import { AnularPagoDialog } from './AnularPagoDialog'

type CuotaDetalle = { mes: number; año: number; alumno: string }
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
  anulado: boolean
  motivo_anulacion: string | null
  anulado_at: string | null
  pagadores: { nombre: string; mail: string; telefono: string | null } | null
  cuotas_detalle: CuotaDetalle[]
}

export function PagosHistoryPanel() {
  const [pagos, setPagos] = useState<PagoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [verAnulados, setVerAnulados] = useState(false)
  const [anulando, setAnulando] = useState<PagoRow | null>(null)

  const cargar = useCallback(() => {
    setLoading(true)
    getPagosRecientes({ incluirAnulados: verAnulados, limit: 200 })
      .then((data) => setPagos(data as PagoRow[]))
      .finally(() => setLoading(false))
  }, [verAnulados])

  useEffect(() => { cargar() }, [cargar])

  const fmtFecha = (iso: string) => {
    try {
      return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })
    } catch { return iso }
  }

  const metodoBadge = (m: string) => {
    if (m === 'mercadopago') return <Badge variant="secondary">MP</Badge>
    if (m === 'transferencia') return <Badge variant="outline">Transf.</Badge>
    return <Badge variant="outline">Efectivo</Badge>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={verAnulados}
            onChange={(e) => setVerAnulados(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300"
          />
          Mostrar pagos anulados
        </label>
        <Button variant="outline" size="sm" onClick={cargar} className="gap-2 ml-auto">
          <RefreshCw className="h-3.5 w-3.5" />
          Refrescar
        </Button>
        <span className="text-sm text-slate-500">{pagos.length} pagos</span>
      </div>

      {/* Tabla en md+ */}
      <div className="hidden md:block rounded-lg border border-slate-200 overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Fecha</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Pagador</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Aportes saldados</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Método</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Descuento</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Monto</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Cargando...</td></tr>
            )}
            {!loading && pagos.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Sin pagos registrados</td></tr>
            )}
            {!loading && pagos.map((p) => (
              <tr
                key={p.id}
                className={`hover:bg-slate-50 transition-colors ${p.anulado ? 'opacity-60 line-through decoration-red-400' : ''}`}
              >
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtFecha(p.fecha)}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{p.pagadores?.nombre ?? '—'}</div>
                  {p.notas && <div className="text-xs text-slate-400 truncate max-w-xs">{p.notas}</div>}
                  {p.anulado && p.motivo_anulacion && (
                    <div className="text-xs text-red-600 no-underline">
                      Anulado: {p.motivo_anulacion}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {p.cuotas_detalle.length === 0 ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <div className="space-y-0.5">
                      {p.cuotas_detalle.slice(0, 3).map((c, i) => (
                        <div key={i} className="text-xs">
                          {formatMes(c.mes, c.año)}{c.alumno && ` · ${c.alumno}`}
                        </div>
                      ))}
                      {p.cuotas_detalle.length > 3 && (
                        <div className="text-xs text-slate-400">+{p.cuotas_detalle.length - 3} más</div>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">{metodoBadge(p.metodo)}</td>
                <td className="px-4 py-3 text-right text-slate-600">
                  {p.descuento > 0 ? formatMonto(p.descuento) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 text-right font-medium">{formatMonto(p.monto)}</td>
                <td className="px-4 py-3">
                  {!p.anulado && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setAnulando(p)}
                      className="text-red-600 hover:bg-red-50"
                      title="Anular pago"
                    >
                      <Ban className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Cards en mobile ──────────────────────────────────────── */}
      <div className="md:hidden space-y-2">
        {loading && (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-400">
            Cargando...
          </div>
        )}
        {!loading && pagos.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-400">
            Sin pagos registrados
          </div>
        )}
        {!loading && pagos.map((p) => (
          <div
            key={p.id}
            className={`rounded-lg border border-slate-200 bg-white p-3 space-y-2 ${
              p.anulado ? 'opacity-60 border-red-200' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className={`font-semibold text-sm text-slate-900 truncate ${p.anulado ? 'line-through' : ''}`}>
                  {p.pagadores?.nombre ?? '—'}
                </p>
                <p className="text-xs text-slate-500">{fmtFecha(p.fecha)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`font-bold text-sm tabular-nums ${p.anulado ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                  {formatMonto(p.monto)}
                </p>
                {metodoBadge(p.metodo)}
              </div>
            </div>

            {p.cuotas_detalle.length > 0 && (
              <div className="text-xs text-slate-600 space-y-0.5 pt-1 border-t border-slate-100">
                {p.cuotas_detalle.slice(0, 2).map((c, i) => (
                  <div key={i}>
                    {formatMes(c.mes, c.año)}{c.alumno && ` · ${c.alumno}`}
                  </div>
                ))}
                {p.cuotas_detalle.length > 2 && (
                  <div className="text-slate-400">+{p.cuotas_detalle.length - 2} más</div>
                )}
              </div>
            )}

            {p.descuento > 0 && (
              <div className="text-xs text-emerald-700">Descuento: {formatMonto(p.descuento)}</div>
            )}

            {p.anulado && p.motivo_anulacion && (
              <div className="text-xs text-red-600 pt-1 border-t border-slate-100">
                <strong>Anulado:</strong> {p.motivo_anulacion}
              </div>
            )}

            {!p.anulado && (
              <div className="pt-1 border-t border-slate-100">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAnulando(p)}
                  className="text-red-600 hover:bg-red-50 h-8 w-full justify-center gap-1.5 text-xs"
                >
                  <Ban className="h-3.5 w-3.5" />
                  Anular pago
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {anulando && (
        <AnularPagoDialog
          pagoId={anulando.id}
          monto={anulando.monto}
          pagador={anulando.pagadores?.nombre ?? '—'}
          open={!!anulando}
          onClose={() => setAnulando(null)}
          onAnulado={cargar}
        />
      )}
    </div>
  )
}
