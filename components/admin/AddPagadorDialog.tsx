'use client'

import { useRef, useTransition } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { altaPagadorYAlumno } from '@/app/admin/actions'
import type { Plan } from '@/types'

type Props = {
  open: boolean
  onClose: () => void
  planes: Plan[]
}

const GRADOS = ['1°', '2°', '3°', '4°', '5°', '6°', '7°']
const TURNOS = ['Mañana', 'Tarde']

export function AddPagadorDialog({ open, onClose, planes }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(formRef.current!)

    startTransition(async () => {
      const result = await altaPagadorYAlumno(formData)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('Pagador y alumno dados de alta correctamente')
        formRef.current?.reset()
        onClose()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar pagador y alumno</DialogTitle>
          <DialogDescription>
            Se creará un usuario de acceso al portal con el mail y contraseña ingresados.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
          {/* Sección pagador */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-slate-100">
              Datos del pagador
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label htmlFor="nombre">Nombre completo *</Label>
                <Input id="nombre" name="nombre" required placeholder="Ana García" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dni">DNI</Label>
                <Input id="dni" name="dni" placeholder="12345678" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input id="telefono" name="telefono" placeholder="11 1234-5678" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mail">Email *</Label>
                <Input id="mail" name="mail" type="email" required placeholder="ana@mail.com" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password">Contraseña portal *</Label>
                <Input id="password" name="password" type="password" required minLength={6} placeholder="Mín. 6 caracteres" />
              </div>
            </div>
          </div>

          {/* Sección alumno */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-slate-100">
              Datos del alumno
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label htmlFor="nombre_alumno">Nombre del alumno *</Label>
                <Input id="nombre_alumno" name="nombre_alumno" required placeholder="Martín García" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="grado">Grado *</Label>
                <select
                  name="grado"
                  required
                  className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  <option value="">Seleccionar</option>
                  {GRADOS.map((g) => (
                    <option key={g} value={g}>{g} grado</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="turno">Turno</Label>
                <select
                  name="turno"
                  className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  <option value="">Sin especificar</option>
                  {TURNOS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 space-y-1">
                <Label htmlFor="plan_id">Plan de cuotas *</Label>
                <select
                  name="plan_id"
                  required
                  className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  <option value="">Seleccionar plan</option>
                  {planes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} — ${p.precio_por_mes}/mes (total ${p.monto_total})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Guardando...' : 'Dar de alta'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
