'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Repeat, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { activarDebitoAutomatico } from '@/app/aporte/[pagadorId]/actions'

type Props = {
  pagadorId: string
  /** Si ya tiene débito automático activo, mostramos solo un cartelito. */
  yaActivo?: boolean
}

export function ActivarDebitoButton({ pagadorId, yaActivo }: Props) {
  const [confirmando, setConfirmando] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (yaActivo) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
        <p className="text-sm font-semibold text-emerald-800">✓ Débito automático activo</p>
        <p className="text-xs text-emerald-700 mt-0.5">
          Mercado Pago cobra solo todos los meses. Vas a recibir la confirmación por mail.
        </p>
      </div>
    )
  }

  const handleActivar = () => {
    startTransition(async () => {
      const r = await activarDebitoAutomatico(pagadorId)
      if (r.error) {
        toast.error(r.error)
        setConfirmando(false)
        return
      }
      if (r.initPoint) {
        // Redirigimos al checkout de MP para cargar la tarjeta
        window.location.href = r.initPoint
      }
    })
  }

  if (confirmando) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">¿Activar débito automático?</p>
          <p className="text-xs text-slate-600 mt-1">
            Cargás tu tarjeta una vez en Mercado Pago y se cobra automáticamente cada mes
            el aporte de tu/s estudiante/s. Lo podés cancelar cuando quieras desde el portal.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setConfirmando(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleActivar} disabled={isPending}>
            {isPending
              ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Activando...</>
              : 'Sí, activar'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirmando(true)}
      className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border-2 border-slate-200 hover:border-slate-300 bg-white text-slate-700 font-medium text-sm transition-colors"
    >
      <Repeat className="h-4 w-4" />
      Activar débito automático
    </button>
  )
}
