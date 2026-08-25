'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Mail, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { probarEmail } from '@/app/admin/actions'

/**
 * Herramienta de diagnóstico: manda un recibo de ejemplo para verificar que
 * los emails salen bien, sin tener que registrar un aporte real.
 */
export function ProbarEmailPanel() {
  const [destino, setDestino] = useState('')
  const [isPending, startTransition] = useTransition()

  const probar = () => {
    startTransition(async () => {
      const r = await probarEmail(destino)
      if (r.error) toast.error(r.error)
      else toast.success(`Recibo de prueba enviado a ${destino}. Revisá la casilla (y Spam).`)
    })
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4 max-w-2xl">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-slate-100 p-2">
          <Mail className="h-5 w-5 text-slate-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Probar envío de emails</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Envía un recibo de ejemplo para verificar que los comprobantes llegan bien.
            No registra ningún aporte.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor="destino" className="text-xs">Enviar a</Label>
          <Input
            id="destino"
            type="email"
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            placeholder="tu@email.com"
          />
        </div>
        <Button
          onClick={probar}
          disabled={isPending || !destino.includes('@')}
          className="gap-2 sm:self-end"
        >
          <Send className="h-4 w-4" />
          {isPending ? 'Enviando…' : 'Enviar prueba'}
        </Button>
      </div>
    </div>
  )
}
