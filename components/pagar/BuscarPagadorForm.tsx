'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ArrowRight, UserPlus, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { buscarPagadorPorDNI } from '@/app/pagar/actions'

export function BuscarPagadorForm() {
  const [dni, setDni] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [noEncontrado, setNoEncontrado] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Limpiamos el DNI a solo dígitos para mostrar el feedback de validación
  const dniLimpio = dni.replace(/\D/g, '')
  const dniValido = dniLimpio.length >= 6

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setNoEncontrado(false)
    startTransition(async () => {
      const r = await buscarPagadorPorDNI(dni)
      if (r.error) {
        setError(r.error)
        // Si el motivo del error es "no encontrado", activamos el atajo a registro
        if (r.error.toLowerCase().includes('no encontramos')) {
          setNoEncontrado(true)
        }
        return
      }
      router.push(`/aporte/${r.id}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="dni">DNI del pagador / tutor</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            id="dni"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="20123456"
            value={dni}
            onChange={(e) => {
              setDni(e.target.value)
              setError(null)
              setNoEncontrado(false)
            }}
            className="pl-9"
            required
          />
        </div>
      </div>

      {error && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-md px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
          {noEncontrado && (
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() => {
                // Pre-llenamos el DNI en el form de registro para que no lo
                // tipee de nuevo. Solo dígitos por las dudas.
                const dniLimpio = dni.replace(/\D/g, '')
                router.push(`/registro?dni=${encodeURIComponent(dniLimpio)}`)
              }}
            >
              <UserPlus className="h-4 w-4" />
              Registrarme con este DNI
            </Button>
          )}
        </div>
      )}

      <Button type="submit" className="w-full gap-2" disabled={isPending || !dniValido}>
        {isPending ? 'Buscando...' : (
          <>
            Continuar <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  )
}
