'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { editarAlumno, cambiarEstadoAlumno, cambiarPlanAlumno } from '@/app/admin/actions'
import type { AlumnoConEstado, Plan } from '@/types'

type Props = {
  alumno: AlumnoConEstado
  planes: Plan[]
  open: boolean
  onClose: () => void
}

const TURNOS = ['Mañana', 'Noche']

export function EditStudentDialog({ alumno, planes, open, onClose }: Props) {
  const [nombre, setNombre]   = useState(alumno.nombre)
  const [grado, setGrado]     = useState(alumno.grado)
  const [turno, setTurno]     = useState(alumno.turno ?? '')
  const [notas, setNotas]     = useState(alumno.notas ?? '')
  const [planId, setPlanId]   = useState(alumno.suscripcion_activa?.plan_id ?? '')
  const [isPending, startTransition] = useTransition()

  const planActualId = alumno.suscripcion_activa?.plan_id ?? ''

  const guardar = () => {
    const fd = new FormData()
    fd.set('alumno_id', alumno.id)
    fd.set('nombre', nombre)
    fd.set('grado', grado)
    fd.set('turno', turno)
    fd.set('notas', notas)

    startTransition(async () => {
      const r = await editarAlumno(fd)
      if (r?.error) { toast.error(r.error); return }

      // Si cambió de plan, también lo actualizamos
      if (planId && planId !== planActualId) {
        const fdPlan = new FormData()
        fdPlan.set('alumno_id', alumno.id)
        fdPlan.set('plan_id', planId)
        const rPlan = await cambiarPlanAlumno(fdPlan)
        if (rPlan?.error) { toast.error(`Datos guardados, pero falló cambio de plan: ${rPlan.error}`); return }
      }

      toast.success('Alumno actualizado')
      onClose()
    })
  }

  const desactivar = () => {
    if (!confirm(`¿Marcar a ${alumno.nombre} como inactivo? Se cancelará su suscripción y dejará de generar aportes nuevos. Los aportes ya generados se mantienen para el historial.`)) return
    const fd = new FormData()
    fd.set('alumno_id', alumno.id)
    fd.set('activo', 'false')
    startTransition(async () => {
      const r = await cambiarEstadoAlumno(fd)
      if (r?.error) toast.error(r.error)
      else { toast.success('Alumno desactivado'); onClose() }
    })
  }

  const reactivar = () => {
    const fd = new FormData()
    fd.set('alumno_id', alumno.id)
    fd.set('activo', 'true')
    startTransition(async () => {
      const r = await cambiarEstadoAlumno(fd)
      if (r?.error) toast.error(r.error)
      else { toast.success('Alumno reactivado (recordá asignarle un plan vigente)'); onClose() }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar alumno</DialogTitle>
          <DialogDescription>
            Cambios en datos personales, plan y estado del alumno.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Nombre</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Grado / Curso</Label>
              <Input value={grado} onChange={(e) => setGrado(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Turno</Label>
              <select
                value={turno}
                onChange={(e) => setTurno(e.target.value)}
                className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="">—</option>
                {TURNOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Plan asignado</Label>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="">— sin plan —</option>
              {planes.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre} (${p.precio_por_mes}/mes)</option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              Cambiar el plan crea una nueva suscripción. No modifica los aportes ya generados.
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notas internas</Label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Ej: hablado el 15/4, pidió hasta fin de mes..."
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
          {alumno.activo ? (
            <Button variant="outline" onClick={desactivar} disabled={isPending} className="text-red-600 border-red-200 hover:bg-red-50">
              Desactivar alumno
            </Button>
          ) : (
            <Button variant="outline" onClick={reactivar} disabled={isPending} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
              Reactivar alumno
            </Button>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
            <Button onClick={guardar} disabled={isPending}>Guardar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
