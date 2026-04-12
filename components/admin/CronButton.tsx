'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ejecutarCronMensual } from '@/app/admin/actions'
import { formatMes } from '@/lib/utils'

export function CronButton() {
  const [isPending, startTransition] = useTransition()

  const ahora = new Date()
  const mesActual = ahora.getMonth() + 1
  const añoActual = ahora.getFullYear()
  const fechaMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1)

  const handleCron = () => {
    startTransition(async () => {
      const result = await ejecutarCronMensual()
      if (result?.success) {
        toast.success(
          `Cron ejecutado: ${result.cuotasGeneradas} cuota${result.cuotasGeneradas !== 1 ? 's' : ''} generada${result.cuotasGeneradas !== 1 ? 's' : ''}, ${result.cuotasVencidas} marcada${result.cuotasVencidas !== 1 ? 's' : ''} como vencida${result.cuotasVencidas !== 1 ? 's' : ''}`
        )
      } else {
        toast.error('Error al ejecutar el cron')
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Generación mensual de cuotas</CardTitle>
        <CardDescription>
          Esta acción:
          <ol className="list-decimal list-inside mt-1 space-y-0.5">
            <li>Genera las cuotas de <strong>{formatMes(mesActual, añoActual)}</strong> para todas las suscripciones activas</li>
            <li>Marca como <strong>vencidas</strong> las cuotas pendientes de {formatMes(fechaMesAnterior.getMonth() + 1, fechaMesAnterior.getFullYear())}</li>
          </ol>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleCron} disabled={isPending} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
          {isPending ? 'Ejecutando...' : 'Ejecutar proceso mensual'}
        </Button>
        <p className="mt-2 text-xs text-slate-400">
          Las cuotas ya existentes no se duplican. Podés ejecutar esto varias veces de forma segura.
        </p>
      </CardContent>
    </Card>
  )
}
