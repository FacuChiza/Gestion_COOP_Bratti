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
import { editarPagador } from '@/app/admin/actions'
import type { Pagador } from '@/types'

type Props = {
  pagador: Pagador
  open: boolean
  onClose: () => void
}

export function EditPagadorDialog({ pagador, open, onClose }: Props) {
  const [nombre, setNombre]     = useState(pagador.nombre)
  const [dni, setDni]           = useState(pagador.dni ?? '')
  const [telefono, setTelefono] = useState(pagador.telefono ?? '')
  const [mail, setMail]         = useState(pagador.mail)
  const [notas, setNotas]       = useState(pagador.notas ?? '')
  const [isPending, startTransition] = useTransition()

  const mailCambiado = mail.trim().toLowerCase() !== pagador.mail.toLowerCase()

  const guardar = () => {
    const fd = new FormData()
    fd.set('pagador_id', pagador.id)
    fd.set('nombre', nombre)
    fd.set('dni', dni)
    fd.set('telefono', telefono)
    fd.set('mail', mail)
    fd.set('notas', notas)

    startTransition(async () => {
      const r = await editarPagador(fd)
      if (r?.error) toast.error(r.error)
      else { toast.success('Pagador actualizado'); onClose() }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar pagador</DialogTitle>
          <DialogDescription>
            Datos de contacto del pagador / tutor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Nombre completo</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">DNI</Label>
              <Input value={dni} onChange={(e) => setDni(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Teléfono (con código de país)</Label>
              <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+5491155551234" />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Email</Label>
            <Input type="email" value={mail} onChange={(e) => setMail(e.target.value)} />
            {mailCambiado && (
              <p className="text-xs text-amber-600">
                ⚠️ Cambiar el email también actualiza el usuario de login en el sistema. El pagador deberá usar el nuevo email para entrar al portal.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notas internas</Label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              placeholder="Anotaciones que solo ven los directivos..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
          <Button onClick={guardar} disabled={isPending}>Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
