'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { FileText, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getReporteAnual, type ReporteAnual } from '@/app/admin/actions'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const money = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`

const NOMBRE_METODO: Record<string, string> = {
  mercadopago: 'Mercado Pago',
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  modo: 'MODO',
  otro: 'Otro',
}

/** Arma el HTML del reporte y lo manda a imprimir (el navegador ofrece "Guardar como PDF"). */
function imprimirReporte(r: ReporteAnual) {
  const fecha = new Date(r.generado).toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  const cobrado = r.recaudadoAnio + r.montoPendiente
  const pct = cobrado > 0 ? Math.round((r.recaudadoAnio / cobrado) * 100) : 0
  const maxMes = Math.max(...r.porMes.map((m) => m.recaudado), 1)

  const filasMes = r.porMes.map((m) => `
    <tr>
      <td>${MESES[m.mes - 1]}</td>
      <td class="num">${m.pagadas}</td>
      <td class="num">${money(m.recaudado)}</td>
      <td><div class="bar" style="width:${Math.round((m.recaudado / maxMes) * 100)}%"></div></td>
    </tr>`).join('')

  const filasMetodo = r.porMetodo.length
    ? r.porMetodo.map((m) => `
      <tr>
        <td>${NOMBRE_METODO[m.metodo] ?? m.metodo}</td>
        <td class="num">${m.cantidad}</td>
        <td class="num">${money(m.total)}</td>
        <td class="num">${r.recaudadoAnio ? Math.round((m.total / r.recaudadoAnio) * 100) : 0}%</td>
      </tr>`).join('')
    : '<tr><td colspan="4" class="empty">Sin aportes registrados</td></tr>'

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<title>Resumen ${r.anio} - Cooperadora Bratti</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color:#0f172a; margin:0; }
  h1 { font-size:22px; margin:0 0 2px; }
  h2 { font-size:14px; margin:26px 0 8px; text-transform:uppercase; letter-spacing:.06em; color:#475569; border-bottom:1px solid #e2e8f0; padding-bottom:4px; }
  .sub { color:#64748b; font-size:12px; margin:0; }
  .head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #0f172a; padding-bottom:10px; }
  .cards { display:flex; gap:10px; margin-top:14px; }
  .card { flex:1; border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px; }
  .card .lbl { font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:#64748b; }
  .card .val { font-size:19px; font-weight:bold; margin-top:3px; }
  .ok { color:#047857; } .warn { color:#b45309; }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  th { text-align:left; background:#f1f5f9; padding:6px 8px; font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:#475569; }
  td { padding:5px 8px; border-bottom:1px solid #f1f5f9; }
  .num { text-align:right; white-space:nowrap; }
  .bar { height:8px; background:#0f172a; border-radius:4px; min-width:1px; }
  .empty { color:#94a3b8; text-align:center; font-style:italic; }
  .foot { margin-top:28px; padding-top:8px; border-top:1px solid #e2e8f0; font-size:10px; color:#94a3b8; text-align:center; }
</style></head><body>
  <div class="head">
    <div>
      <h1>Resumen del ciclo ${r.anio}</h1>
      <p class="sub">Cooperadora Escolar &middot; Escuela T&eacute;cnica N&deg; 34 Bratti</p>
    </div>
    <p class="sub">Generado el ${fecha}</p>
  </div>

  <div class="cards">
    <div class="card"><div class="lbl">Recaudado en el a&ntilde;o</div><div class="val ok">${money(r.recaudadoAnio)}</div></div>
    <div class="card"><div class="lbl">Aportes recibidos</div><div class="val">${r.porMetodo.reduce((a, m) => a + m.cantidad, 0)}</div></div>
    <div class="card"><div class="lbl">Pendiente de cobro</div><div class="val warn">${money(r.montoPendiente)}</div></div>
    <div class="card"><div class="lbl">Nivel de cumplimiento</div><div class="val">${pct}%</div></div>
  </div>

  <div class="cards">
    <div class="card"><div class="lbl">Alumnos activos</div><div class="val">${r.alumnosActivos}</div></div>
    <div class="card"><div class="lbl">Aportantes registrados</div><div class="val">${r.aportantes}</div></div>
    <div class="card"><div class="lbl">Recaudado este mes</div><div class="val">${money(r.recaudadoMes)}</div></div>
    <div class="card"><div class="lbl">Aportes sin pagar</div><div class="val">${r.cantPendientes}</div></div>
  </div>

  <h2>Evoluci&oacute;n mensual</h2>
  <table>
    <thead><tr><th>Mes</th><th class="num">Aportes</th><th class="num">Recaudado</th><th style="width:32%">&nbsp;</th></tr></thead>
    <tbody>${filasMes}</tbody>
  </table>

  <h2>Medios de pago</h2>
  <table>
    <thead><tr><th>M&eacute;todo</th><th class="num">Cantidad</th><th class="num">Total</th><th class="num">%</th></tr></thead>
    <tbody>${filasMetodo}</tbody>
  </table>

  <p class="foot">Documento generado autom&aacute;ticamente por el sistema de gesti&oacute;n de aportes de la Cooperadora Escolar.</p>
</body></html>`

  const w = window.open('', '_blank')
  if (!w) { toast.error('El navegador bloqueó la ventana. Permití las ventanas emergentes.'); return }
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 400)
}

export function ReporteAnualPanel() {
  const anioActual = new Date().getFullYear()
  const [isPending, startTransition] = useTransition()

  const generar = () => {
    startTransition(async () => {
      const r = await getReporteAnual()
      imprimirReporte(r)
    })
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4 max-w-2xl">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-slate-100 p-2">
          <FileText className="h-5 w-5 text-slate-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Resumen del ciclo {anioActual} (PDF)</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Informe con lo recaudado, lo pendiente, la evolución mes a mes y los medios de
            pago. Se puede generar en cualquier momento del año.
          </p>
        </div>
      </div>

      <Button onClick={generar} disabled={isPending} className="gap-2">
        <Download className="h-4 w-4" />
        {isPending ? 'Generando…' : 'Generar PDF'}
      </Button>

      <p className="text-xs text-slate-400">
        Se abre la vista de impresión: elegí <strong>“Guardar como PDF”</strong> como destino.
      </p>
    </div>
  )
}
