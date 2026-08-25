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
          `Proceso ejecutado: ${result.cuotasGeneradas} aporte${result.cuotasGeneradas !== 1 ? 's' : ''} generado${result.cuotasGeneradas !== 1 ? 's' : ''}, ${result.cuotasVencidas} marcado${result.cuotasVencidas !== 1 ? 's' : ''} como no realizado${result.cuotasVencidas !== 1 ? 's' : ''}`
        )
      } else {
        toast.error('Error al ejecutar el cron')
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Generación mensual de aportes</CardTitle>
        <CardDescription>
          <span className="block mb-2">
            Esto se hace <strong>solo, el día 1 de cada mes</strong>. No hace falta que lo
            ejecutes: el botón está por si necesitás adelantarlo o repetirlo.
          </span>
          Al ejecutarlo:
          <ol className="list-decimal list-inside mt-1 space-y-0.5">
            <li>Genera el aporte de <strong>{formatMes(mesActual, añoActual)}</strong> para cada alumno activo</li>
            <li>Marca como <strong>no realizados</strong> los aportes pendientes de {formatMes(fechaMesAnterior.getMonth() + 1, fechaMesAnterior.getFullYear())}</li>
          </ol>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={handleCron} disabled={isPending} variant="outline" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
          {isPending ? 'Ejecutando...' : 'Ejecutar ahora'}
        </Button>
        <p className="mt-2 text-xs text-slate-400">
          Es seguro: los aportes ya generados no se duplican.
        </p>
      </CardContent>
    </Card>
  )
}
