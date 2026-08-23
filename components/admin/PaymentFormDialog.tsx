'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { formatMes, formatMonto } from '@/lib/utils'
import { getCuotasPendientesAlumno, registrarPago } from '@/app/admin/actions'
import type { AlumnoConEstado, Cuota } from '@/types'

type Props = {
  alumno: AlumnoConEstado
  open: boolean
  onClose: () => void
}

export function PaymentFormDialog({ alumno, open, onClose }: Props) {
  const [cuotas, setCuotas]           = useState<Cuota[]>([])
  const [seleccionadas, setSeleccionadas] = useState<string[]>([])
  const [notas, setNotas]             = useState('')
  const [descuento, setDescuento]     = useState<string>('0')
  const [comprobante, setComprobante] = useState('')
  const [metodo, setMetodo]           = useState<'efectivo' | 'transferencia' | 'mercadopago' | 'modo' | 'otro'>('efectivo')
  const [isPending, startTransition]  = useTransition()

  useEffect(() => {
    if (open) {
      setNotas('')
      setDescuento('0')
      setComprobante('')
      setMetodo('efectivo')
      getCuotasPendientesAlumno(alumno.id).then((data) => {
        setCuotas(data as Cuota[])
        setSeleccionadas(data.map((c) => c.id)) // todas pre-seleccionadas
      })
    }
  }, [open, alumno.id])

  const montoBruto = cuotas
    .filter((c) => seleccionadas.includes(c.id))
    .reduce((acc, c) => acc + c.monto, 0)

  const descNum = Math.max(0, Number(descuento) || 0)
  const montoTotal = Math.max(0, montoBruto - descNum)

  const toggleCuota = (id: string) => {
    setSeleccionadas((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleSubmit = () => {
    if (seleccionadas.length === 0) {
      toast.error('Seleccioná al menos un aporte')
      return
    }
    if (descNum > montoBruto) {
      toast.error('El descuento no puede ser mayor al total bruto')
      return
    }

    const formData = new FormData()
    formData.set('pagador_id', alumno.pagador_id ?? '')
    seleccionadas.forEach((id) => formData.append('cuota_ids', id))
    formData.set('notas', notas)
    formData.set('descuento', String(descNum))
    formData.set('metodo', metodo)
    formData.set('comprobante', comprobante)

    startTransition(async () => {
      const result = await registrarPago(formData)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(`Pago registrado — ${formatMonto(montoTotal)}`)
        onClose()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar aporte — {alumno.nombre}</DialogTitle>
          <DialogDescription>
            Seleccioná los aportes que el/la pagador/a realiza en este momento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Lista de cuotas */}
          <div>
            <Label className="mb-2 block">Aportes pendientes</Label>
            {cuotas.length === 0 ? (
              <p className="text-sm text-slate-400">Sin aportes pendientes</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {cuotas.map((cuota) => (
                  <label
                    key={cuota.id}
                    className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={seleccionadas.includes(cuota.id)}
                        onChange={() => toggleCuota(cuota.id)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span className="text-sm">{formatMes(cuota.mes, cuota.año)}</span>
                      <Badge variant={cuota.estado === 'vencida' ? 'danger' : 'warning'}>
                        {cuota.estado}
                      </Badge>
                    </div>
                    <span className="text-sm font-medium">{formatMonto(cuota.monto)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Método y descuento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Método</Label>
              <select
                value={metodo}
                onChange={(e) => setMetodo(e.target.value as typeof metodo)}
                className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="modo">MODO</option>
                <option value="mercadopago">Mercado Pago</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descuento ($)</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={descuento}
                onChange={(e) => setDescuento(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Comprobante / referencia (para transferencia, MODO, etc.) */}
          {metodo !== 'efectivo' && (
            <div className="space-y-1">
              <Label htmlFor="comprobante" className="text-xs">N° de comprobante / operación (opcional)</Label>
              <Input
                id="comprobante"
                value={comprobante}
                onChange={(e) => setComprobante(e.target.value)}
                placeholder="Ej: 00012345 o el ID de la transferencia"
              />
            </div>
          )}

          {/* Notas */}
          <div className="space-y-1">
            <Label htmlFor="notas">Notas (opcional)</Label>
            <Textarea
              id="notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: pagó en dos partes, motivo del descuento, etc."
              rows={2}
            />
          </div>

          {/* Total */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Subtotal</span>
              <span>{formatMonto(montoBruto)}</span>
            </div>
            {descNum > 0 && (
              <div className="flex items-center justify-between text-xs text-emerald-700">
                <span>Descuento</span>
                <span>− {formatMonto(descNum)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-slate-200 pt-1 mt-1">
              <span className="font-semibold text-slate-700">Total a cobrar</span>
              <span className="text-lg font-bold text-slate-900">{formatMonto(montoTotal)}</span>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isPending || seleccionadas.length === 0}>
              {isPending ? 'Registrando...' : 'Confirmar aporte'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
