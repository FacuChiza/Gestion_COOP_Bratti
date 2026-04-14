'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { UserPlus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { agregarEstudianteAction } from '@/app/cuenta/actions'

const CURSOS_MANANA = [
  '1° A', '1° B', '2° A', '2° B', '3° A', '3° B',
  '4° A', '4° B', '5° A', '5° B', '6°', '7°',
]
const CURSOS_NOCHE = ['1°', '2°', '3°']
const TURNOS = [
  { valor: 'Mañana', emoji: '🌅' },
  { valor: 'Noche',  emoji: '🌙' },
]

type Props = {
  open: boolean
  onClose: () => void
}

export function AddStudentDialog({ open, onClose }: Props) {
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const turno = formData.get('turno') as string
    if (!turno) { toast.error('Seleccioná el turno'); return }

    startTransition(async () => {
      const result = await agregarEstudianteAction(formData)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('Estudiante agregado/a correctamente')
        onClose()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Agregar otro/a estudiante
          </DialogTitle>
          <DialogDescription>
            Se vinculará a tu misma cuenta. Podés ver todos tus estudiantes desde el dashboard.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="nombre_alumno">Nombre del/la estudiante</Label>
            <Input
              id="nombre_alumno"
              name="nombre_alumno"
              required
              placeholder="Sofía García"
            />
          </div>

          <TurnoYCursoField />

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={isPending}>
              {isPending ? 'Guardando...' : 'Agregar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Subcomponente con estado propio para turno/curso
function TurnoYCursoField() {
  const [turno, setTurno] = React.useState('')
  const cursos = turno === 'Noche' ? CURSOS_NOCHE : CURSOS_MANANA

  return (
    <>
      <input type="hidden" name="turno" value={turno} />

      <div className="space-y-2">
        <Label>Turno</Label>
        <div className="grid grid-cols-2 gap-2">
          {TURNOS.map(t => (
            <button
              key={t.valor}
              type="button"
              onClick={() => setTurno(t.valor)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg border-2 py-2.5 text-sm font-medium transition-all',
                turno === t.valor
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 hover:border-slate-300 text-slate-700'
              )}
            >
              <span>{t.emoji}</span>
              <span>{t.valor}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="grado_nuevo">Año / Curso</Label>
        <select
          id="grado_nuevo"
          name="grado"
          required
          disabled={!turno}
          className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50"
        >
          <option value="">{turno ? 'Seleccioná el año' : 'Primero elegí el turno'}</option>
          {cursos.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
    </>
  )
}

import React from 'react'
