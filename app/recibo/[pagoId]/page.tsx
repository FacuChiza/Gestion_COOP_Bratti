/**
 * /recibo/[pagoId] — Comprobante formal de aporte, imprimible y descargable.
 *
 * Es público: la llave es el UUID del pago (no adivinable) y solo muestra
 * datos no sensibles (nombre del aportante, alumno, curso y monto).
 * El aportante llega acá desde el email; la cooperadora, desde el panel.
 */

import { notFound } from 'next/navigation'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatMonto, formatMes } from '@/lib/utils'
import { BotonImprimir } from '@/components/recibo/BotonImprimir'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Comprobante de aporte' }

const NOMBRE_METODO: Record<string, string> = {
  mercadopago: 'Mercado Pago',
  efectivo: 'Efectivo',
  transferencia: 'Transferencia bancaria',
  modo: 'MODO',
  otro: 'Otro medio',
}

type CuotaDetalle = {
  cuotas: { mes: number; año: number; monto: number; alumnos: { nombre: string; grado: string } | null } | null
}

export default async function ReciboPage({ params }: { params: { pagoId: string } }) {
  const admin = createAdminClient()

  const { data: pago } = await admin
    .from('pagos')
    .select('id, monto, descuento, fecha, metodo, referencia_externa, notas, anulado, pagadores(nombre)')
    .eq('id', params.pagoId)
    .maybeSingle()

  if (!pago) notFound()

  const { data: vinculos } = await admin
    .from('pagos_cuotas')
    .select('cuotas(mes, año, monto, alumnos(nombre, grado))')
    .eq('pago_id', params.pagoId)

  const detalle = ((vinculos ?? []) as unknown as CuotaDetalle[])
    .map((v) => v.cuotas)
    .filter(Boolean) as NonNullable<CuotaDetalle['cuotas']>[]

  const alumnos = Array.from(new Set(detalle.map((c) => c.alumnos?.nombre).filter(Boolean))) as string[]
  const curso = detalle[0]?.alumnos?.grado ?? ''
  const pagador = (pago.pagadores as unknown as { nombre: string } | null)?.nombre ?? '—'
  const nroRecibo = pago.id.slice(0, 8).toUpperCase()
  const fecha = new Date(String(pago.fecha) + 'T00:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 print:bg-white print:p-0">
      {/* Acciones (no se imprimen) */}
      <div className="max-w-[820px] mx-auto mb-4 flex justify-end print:hidden">
        <BotonImprimir />
      </div>

      <div className="max-w-[820px] mx-auto bg-white shadow-sm print:shadow-none border border-slate-200 print:border-0">
        {/* Encabezado institucional */}
        <div className="flex items-start justify-between gap-4 px-8 pt-8 pb-5 border-b-4 border-slate-900">
          <div className="flex items-center gap-4">
            <Image src="/logobratti.svg" alt="Bratti" width={110} height={80} priority />
            <div className="border-l border-slate-200 pl-4">
              <p className="font-bold text-slate-900 leading-tight">Cooperadora Escolar</p>
              <p className="text-sm text-slate-500">Escuela Técnica N° 34 &ldquo;Bratti&rdquo;</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-slate-400">Comprobante</p>
            <p className="text-lg font-bold text-slate-900">N° {nroRecibo}</p>
            <p className="text-xs text-slate-500 mt-0.5">{fecha}</p>
          </div>
        </div>

        {/* Anulado */}
        {pago.anulado && (
          <div className="mx-8 mt-6 rounded-md border-2 border-red-300 bg-red-50 px-4 py-3 text-center">
            <p className="font-bold text-red-700 tracking-wider">COMPROBANTE ANULADO</p>
          </div>
        )}

        <div className="px-8 py-7 space-y-7">
          <h1 className="text-xl font-bold text-slate-900">Comprobante de aporte voluntario</h1>

          {/* Datos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-slate-400">Aportante</p>
              <p className="font-semibold text-slate-900 mt-0.5">{pagador}</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-slate-400">
                {alumnos.length > 1 ? 'Estudiantes' : 'Estudiante'}
              </p>
              <p className="font-semibold text-slate-900 mt-0.5">
                {alumnos.length ? alumnos.join(' · ') : '—'}
              </p>
              {curso && <p className="text-xs text-slate-500">{curso}</p>}
            </div>
          </div>

          {/* Detalle */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 mb-2">Detalle del aporte</p>
            <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="text-left font-medium px-4 py-2">Concepto</th>
                  <th className="text-right font-medium px-4 py-2">Importe</th>
                </tr>
              </thead>
              <tbody>
                {detalle.length > 0 ? (
                  detalle.map((c, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-700">
                        Aporte {formatMes(c.mes, c.año)}
                        {alumnos.length > 1 && c.alumnos?.nombre ? ` — ${c.alumnos.nombre}` : ''}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-900">{formatMonto(c.monto)}</td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-t border-slate-100">
                    <td className="px-4 py-2 text-slate-700">
                      {pago.notas || 'Aporte voluntario a la Cooperadora Escolar'}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-900">{formatMonto(pago.monto)}</td>
                  </tr>
                )}
                {(pago.descuento ?? 0) > 0 && (
                  <tr className="border-t border-slate-100">
                    <td className="px-4 py-2 text-emerald-700">Descuento aplicado</td>
                    <td className="px-4 py-2 text-right tabular-nums text-emerald-700">
                      − {formatMonto(pago.descuento)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between rounded-lg bg-slate-900 text-white px-5 py-4">
            <span className="text-sm text-white/70">Total abonado</span>
            <span className="text-2xl font-bold tabular-nums">{formatMonto(pago.monto)}</span>
          </div>

          {/* Medio de pago */}
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div>
              <span className="text-slate-400">Medio de pago: </span>
              <span className="text-slate-800 font-medium">
                {NOMBRE_METODO[pago.metodo] ?? pago.metodo}
              </span>
            </div>
            {pago.referencia_externa && (
              <div>
                <span className="text-slate-400">Referencia: </span>
                <span className="text-slate-800 font-medium">{pago.referencia_externa}</span>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-4">
            Este comprobante acredita el <strong>aporte voluntario</strong> realizado a la
            Cooperadora Escolar de la Escuela Técnica N° 34 &ldquo;Bratti&rdquo;. Los aportes se
            destinan íntegramente a mejoras y necesidades de la institución.
            <br />
            <span className="text-slate-400">
              Documento generado electrónicamente. No requiere firma.
            </span>
          </p>
        </div>
      </div>

      <p className="max-w-[820px] mx-auto text-center text-xs text-slate-400 mt-4 print:hidden">
        Guardalo con &ldquo;Descargar comprobante&rdquo; → destino &ldquo;Guardar como PDF&rdquo;.
      </p>
    </div>
  )
}
