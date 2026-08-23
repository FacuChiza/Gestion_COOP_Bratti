'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { anularPago } from '@/app/admin/actions'
import { formatMonto } from '@/lib/utils'

type Props = {
  pagoId: string
  monto: number
  pagador: string
  open: boolean
  onClose: () => void
  onAnulado?: () => void
}

export function AnularPagoDialog({ pagoId, monto, pagador, open, onClose, onAnulado }: Props) {
  const [motivo, setMotivo] = useState('')
  const [isPending, startTransition] = useTransition()

  const confirmar = () => {
    if (!motivo.trim()) {
      toast.error('El motivo es obligatorio para auditoría')
      return
    }
    const fd = new FormData()
    fd.set('pago_id', pagoId)
    fd.set('motivo', motivo.trim())
    startTransition(async () => {
      const r = await anularPago(fd)
      if (r?.error) {
        toast.error(r.error)
      } else {
        toast.success(`Aporte anulado. ${r.cuotasRevertidas ?? 0} aporte(s) volvieron a pendiente.`)
        setMotivo('')
        onAnulado?.()
        onClose()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Anular aporte recibido</DialogTitle>
          <DialogDescription>
            No se borra de la base — queda marcado como anulado con el motivo y la fecha.
            Los aportes que había saldado vuelven a aparecer como pendientes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
            <div className="text-slate-700"><strong>{pagador}</strong></div>
            <div className="text-slate-600">Monto: {formatMonto(monto)}</div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Motivo de la anulación *</Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Ej: error de carga, pago duplicado, devolución solicitada, etc."
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={isPending}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isPending ? 'Anulando...' : 'Anular aporte'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
