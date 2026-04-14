'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { UserPlus, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddStudentDialog } from './AddStudentDialog'

type Props = {
  cantidadAlumnos: number
}

export function DashboardClient({ cantidadAlumnos }: Props) {
  const [open, setOpen] = useState(false)
  const [banner, setBanner] = useState<'ok' | 'error' | 'pendiente' | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    const pago = searchParams.get('pago')
    if (pago === 'ok' || pago === 'error' || pago === 'pendiente') {
      setBanner(pago as 'ok' | 'error' | 'pendiente')
      // Limpiar el param de la URL sin recargar
      const url = new URL(window.location.href)
      url.searchParams.delete('pago')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams])

  return (
    <>
      {/* Banners resultado de pago MP */}
      {banner === 'ok' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-emerald-800 text-sm">¡Pago exitoso! 🎉</p>
            <p className="text-xs text-emerald-600">
              Tu pago fue procesado. Las cuotas pueden tardar unos minutos en actualizarse.
            </p>
          </div>
          <button
            onClick={() => setBanner(null)}
            className="text-emerald-400 hover:text-emerald-600 text-xl leading-none"
          >
            ×
          </button>
        </div>
      )}
      {banner === 'pendiente' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <Clock className="h-5 w-5 text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-amber-800 text-sm">Pago en proceso</p>
            <p className="text-xs text-amber-600">
              MercadoPago está procesando tu pago. Te avisaremos cuando esté confirmado.
            </p>
          </div>
          <button
            onClick={() => setBanner(null)}
            className="text-amber-400 hover:text-amber-600 text-xl leading-none"
          >
            ×
          </button>
        </div>
      )}
      {banner === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <XCircle className="h-5 w-5 text-red-500 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-red-800 text-sm">Pago no completado</p>
            <p className="text-xs text-red-600">
              Hubo un problema con el pago. Podés intentarlo de nuevo.
            </p>
          </div>
          <button
            onClick={() => setBanner(null)}
            className="text-red-400 hover:text-red-600 text-xl leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Encabezado sección */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">
          Mis estudiantes
          <span className="ml-2 text-sm font-normal text-slate-400">
            ({cantidadAlumnos})
          </span>
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="gap-1.5 text-sm"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Agregar estudiante
        </Button>
      </div>

      <AddStudentDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
