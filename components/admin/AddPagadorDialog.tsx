'use client'

import { useRef, useTransition } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { altaPagadorYAlumno } from '@/app/admin/actions'
import type { Plan } from '@/types'

type Props = {
  open: boolean
  onClose: () => void
  planes: Plan[]
}

const GRADOS = ['1°', '2°', '3°', '4°', '5°', '6°', '7°']
const TURNOS = ['Mañana', 'Noche']

export function AddPagadorDialog({ open, onClose }: Props) {
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
        toast.success('Alumno agregado correctamente')
        formRef.current?.reset()
        onClose()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar alumno</DialogTitle>
          <DialogDescription>
            El alumno queda activo y genera su aporte mensual automáticamente. Los datos del
            aportante son opcionales (para contacto y recibos).
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
          {/* Sección alumno */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 pb-1 border-b border-slate-100">
              Datos del alumno
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="col-span-1 sm:col-span-2 space-y-1">
                <Label htmlFor="nombre_alumno">Nombre del alumno *</Label>
                <Input id="nombre_alumno" name="nombre_alumno" required placeholder="Martín García" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dni_alumno">DNI del alumno</Label>
                <Input id="dni_alumno" name="dni_alumno" inputMode="numeric" placeholder="45123456" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="grado">Grado / Curso *</Label>
                <select
                  id="grado"
                  name="grado"
                  required
                  className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  <option value="">Seleccionar</option>
                  {GRADOS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="turno">Turno</Label>
                <select
                  id="turno"
                  name="turno"
                  className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  <option value="">Sin especificar</option>
                  {TURNOS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Sección aportante (opcional) */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-1 pb-1 border-b border-slate-100">
              Aportante <span className="font-normal text-slate-400">· opcional</span>
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Adulto responsable. Si no lo cargás ahora, se vincula solo cuando realice el primer aporte.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="col-span-1 sm:col-span-2 space-y-1">
                <Label htmlFor="nombre">Nombre y apellido</Label>
                <Input id="nombre" name="nombre" placeholder="Ana García" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dni">DNI</Label>
                <Input id="dni" name="dni" inputMode="numeric" placeholder="20123456" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="telefono">WhatsApp (10 dígitos)</Label>
                <Input id="telefono" name="telefono" inputMode="numeric" placeholder="1122334455" />
              </div>
              <div className="col-span-1 sm:col-span-2 space-y-1">
                <Label htmlFor="mail">Email (para recibos)</Label>
                <Input id="mail" name="mail" type="email" placeholder="ana@mail.com" />
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Guardando...' : 'Agregar alumno'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
