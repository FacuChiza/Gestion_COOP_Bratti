'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
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
  const [isPending, startTransition]  = useTransition()

  useEffect(() => {
    if (open) {
      setNotas('')
      getCuotasPendientesAlumno(alumno.id).then((data) => {
        setCuotas(data as Cuota[])
        setSeleccionadas(data.map((c) => c.id)) // todas pre-seleccionadas
      })
    }
  }, [open, alumno.id])

  const montoTotal = cuotas
    .filter((c) => seleccionadas.includes(c.id))
    .reduce((acc, c) => acc + c.monto, 0)

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
    formData.set('notas', notas)

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
          <DialogTitle>Registrar pago — {alumno.nombre}</DialogTitle>
          <DialogDescription>
            Seleccioná las cuotas que el/la pagador/a abona en este momento.
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

          {/* Notas */}
          <div className="space-y-1">
            <Label htmlFor="notas">Notas (opcional)</Label>
            <Textarea
              id="notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Ej: pagó en dos partes, trajo el dinero el/la alumno/a..."
              rows={2}
            />
          </div>

          {/* Total */}
          <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
            <span className="font-semibold text-slate-700">Total a cobrar</span>
            <span className="text-lg font-bold text-slate-900">{formatMonto(montoTotal)}</span>
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
