'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Pencil, Check, X, Sun, Moon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { actualizarPrecio } from '@/app/admin/actions'
import { formatMonto } from '@/lib/utils'
import type { Plan } from '@/types'

type Props = {
  planes: Plan[]
}

function PlanRow({ plan }: { plan: Plan }) {
  const [editando, setEditando] = useState(false)
  // El precio por mes es calculado automáticamente por Postgres
  // (columna GENERATED), por eso editamos monto_total + cantidad_meses.
  const [precioMes, setPrecioMes]   = useState(String(plan.precio_por_mes))
  const [montoTotal, setMontoTotal] = useState(String(plan.monto_total))
  const [isPending, startTransition] = useTransition()

  const esMensual = plan.tipo === 'mensual'

  const handleGuardar = () => {
    // Para planes mensuales (cantidad_meses = 1): editamos monto_total con el
    // valor del input "Precio/mes" (precio_por_mes resultante = ese mismo valor).
    // Para planes anuales: editamos monto_total directamente.
    const nuevoMonto = esMensual ? precioMes : montoTotal

    const formData = new FormData()
    formData.set('plan_id', plan.id)
    formData.set('monto_total', nuevoMonto)
    formData.set('cantidad_meses', String(plan.cantidad_meses))

    startTransition(async () => {
      const result = await actualizarPrecio(formData)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(`Plan "${plan.nombre}" actualizado`)
        setEditando(false)
      }
    })
  }

  const handleCancelar = () => {
    setPrecioMes(String(plan.precio_por_mes))
    setMontoTotal(String(plan.monto_total))
    setEditando(false)
  }

  return (
    <div className="rounded-lg border border-slate-200 px-3 py-3 sm:px-4 bg-white">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-900 text-sm truncate">{plan.nombre}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {plan.tipo === 'mensual'
              ? `${formatMonto(plan.precio_por_mes)}/mes · ${plan.cantidad_meses} meses`
              : `${formatMonto(plan.monto_total)} total · ${formatMonto(plan.precio_por_mes)}/mes`}
          </p>
        </div>

        {!editando && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditando(true)}
            className="gap-1.5 text-slate-500 hover:text-slate-900 shrink-0"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Editar</span>
          </Button>
        )}
      </div>

      {editando && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Precio/mes</Label>
              <Input
                type="number"
                min={1}
                value={precioMes}
                onChange={e => setPrecioMes(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            {!esMensual && (
              <div className="space-y-1">
                <Label className="text-xs">Total anual</Label>
                <Input
                  type="number"
                  min={1}
                  value={montoTotal}
                  onChange={e => setMontoTotal(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancelar}
              disabled={isPending}
              className="gap-1.5"
            >
              <X className="h-3.5 w-3.5" /> Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleGuardar}
              disabled={isPending}
              className="gap-1.5"
            >
              <Check className="h-3.5 w-3.5" /> Guardar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function PreciosPanel({ planes }: Props) {
  // Agrupar por turno
  const diurnos   = planes.filter(p => p.turno === 'diurno')
  const nocturnos = planes.filter(p => p.turno === 'nocturno')
  const otros     = planes.filter(p => p.turno !== 'diurno' && p.turno !== 'nocturno')

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Precios de los planes de aportes</CardTitle>
          <CardDescription>
            Modificá los valores mensuales y anuales de cada plan. Los cambios aplican a las
            nuevas inscripciones y a la generación mensual de aportes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {diurnos.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Sun className="h-3.5 w-3.5" strokeWidth={1.75} />
                Turno Mañana (diurno)
              </p>
              <div className="space-y-2">
                {diurnos.map(p => <PlanRow key={p.id} plan={p} />)}
              </div>
            </div>
          )}

          {nocturnos.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Moon className="h-3.5 w-3.5" strokeWidth={1.75} />
                Turno Noche (nocturno)
              </p>
              <div className="space-y-2">
                {nocturnos.map(p => <PlanRow key={p.id} plan={p} />)}
              </div>
            </div>
          )}

          {otros.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Otros planes
              </p>
              <div className="space-y-2">
                {otros.map(p => <PlanRow key={p.id} plan={p} />)}
              </div>
            </div>
          )}

          {planes.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">
              No hay planes configurados.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="py-4">
          <p className="text-sm text-amber-800">
            ⚠️ <strong>Importante:</strong> cambiar el precio de un plan no afecta los aportes
            ya generados — solo impacta en los aportes que se creen a partir de este momento.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
