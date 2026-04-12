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
  const [cuotas, setCuotas] = useState<Cuota[]>([])
  const [seleccionadas, setSeleccionadas] = useState<string[]>([])
  const [descuento, setDescuento] = useState('0')
  const [notas, setNotas] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open) {
      getCuotasPendientesAlumno(alumno.id).then((data) => {
        setCuotas(data as Cuota[])
        setSeleccionadas(data.map((c) => c.id))
      })
    }
  }, [open, alumno.id])

  const montoBase = cuotas
    .filter((c) => seleccionadas.includes(c.id))
    .reduce((acc, c) => acc + c.monto, 0)

  const montoFinal = montoBase - Number(descuento || 0)

  const toggleCuota = (id: string) => {
    setSeleccionadas((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleSubmit = () => {
    if (seleccionadas.length === 0) {
      toast.error('Seleccioná al menos una cuota')
      return
    }

    const formData = new FormData()
    formData.set('pagador_id', alumno.pagador_id ?? '')
    seleccionadas.forEach((id) => formData.append('cuota_ids', id))
    formData.set('descuento', descuento)
    formData.set('notas', notas)

    startTransition(async () => {
      const result = await registrarPago(formData)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(`Pago registrado — ${formatMonto(montoFinal)}`)
        onClose()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pago — {alumno.nombre}</DialogTitle>
          <DialogDescription>
            Seleccioná las cuotas a pagar y completá los datos del cobro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Lista de cuotas */}
          <div>
            <Label className="mb-2 block">Cuotas pendientes</Label>
            {cuotas.length === 0 ? (
              <p className="text-sm text-slate-400">Sin cuotas pendientes</p>
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

          {/* Descuento */}
          <div className="space-y-1">
            <Label htmlFor="descuento">Descuento ($)</Label>
            <Input
              id="descuento"
              type="number"
              min="0"
              value={descuento}
              onChange={(e) => setDescuento(e.target.value)}
              placeholder="0"
            />
          </div>

          {/* Notas */}
          <div className="space-y-1">
            <Label htmlFor="notas">Notas (opcional)</Label>
            <Textarea
              id="notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: pagó en dos partes..."
              rows={2}
            />
          </div>

          {/* Resumen */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span>{formatMonto(montoBase)}</span>
            </div>
            {Number(descuento) > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Descuento</span>
                <span>- {formatMonto(Number(descuento))}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t border-slate-200 pt-1 mt-1">
              <span>Total a cobrar</span>
              <span>{formatMonto(montoFinal)}</span>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isPending || seleccionadas.length === 0}>
              {isPending ? 'Registrando...' : 'Confirmar pago'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
