'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { buscarPagadorPorDNI } from '@/app/pagar/actions'

export function BuscarPagadorForm() {
  const [dni, setDni] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const r = await buscarPagadorPorDNI(dni)
      if (r.error) {
        setError(r.error)
        return
      }
      // Redirigimos al link personal del pagador, que ya maneja el flujo
      // completo (aportes pendientes, pago puntual, débito automático)
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
            placeholder="20.123.456"
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            className="pl-9"
            required
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full gap-2" disabled={isPending || !dni}>
        {isPending ? 'Buscando...' : (
          <>
            Continuar <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  )
}
