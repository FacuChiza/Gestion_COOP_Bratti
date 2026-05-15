'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Pencil, Check, X, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { actualizarConfiguracion } from '@/app/admin/actions'
import type { ConfiguracionItem } from '@/types'

type Props = {
  configuracion: ConfiguracionItem[]
}

// Metadata legible para cada clave conocida.
// Si aparece una clave nueva en la DB, se muestra con la clave cruda.
const LABELS: Record<string, { label: string; descripcion: string; tipo?: 'numero' | 'porcentaje' | 'dia' }> = {
  meses_alerta_deuda: {
    label: 'Umbral de alerta por aportes pendientes',
    descripcion: 'Cuando un alumno acumula esta cantidad de aportes sin realizar, se envía una única alerta por WhatsApp al pagador. Subilo si querés ser menos insistente, bajalo si querés alertar antes.',
    tipo: 'numero',
  },
  descuento_maximo_porcentaje: {
    label: 'Descuento máximo permitido (%)',
    descripcion: 'Tope de descuento que se puede aplicar al cobrar un aporte (ej: por hermanos, por beca). El sistema impide cargar descuentos mayores a este valor.',
    tipo: 'porcentaje',
  },
  dia_vencimiento: {
    label: 'Día de vencimiento del mes',
    descripcion: 'Día del mes en el que se considera vencido un aporte si no se pagó. Solo informativo (entre 1 y 28).',
    tipo: 'dia',
  },
  monto_cuota_diurno: {
    label: 'Monto de referencia turno diurno',
    descripcion: 'Valor histórico de referencia. El precio real lo definen los planes en la pestaña Configuración.',
    tipo: 'numero',
  },
  monto_cuota_nocturno: {
    label: 'Monto de referencia turno nocturno',
    descripcion: 'Valor histórico de referencia. El precio real lo definen los planes en la pestaña Configuración.',
    tipo: 'numero',
  },
}

function ConfigRow({ item }: { item: ConfiguracionItem }) {
  const meta = LABELS[item.clave] ?? { label: item.clave, descripcion: '' }
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(item.valor)
  const [isPending, startTransition] = useTransition()

  const guardar = () => {
    const fd = new FormData()
    fd.set('clave', item.clave)
    fd.set('valor', valor.trim())
    startTransition(async () => {
      const r = await actualizarConfiguracion(fd)
      if (r?.error) toast.error(r.error)
      else {
        toast.success('Configuración actualizada')
        setEditando(false)
      }
    })
  }

  const cancelar = () => {
    setValor(item.valor)
    setEditando(false)
  }

  const sufijo = meta.tipo === 'porcentaje' ? '%' : meta.tipo === 'dia' ? '' : ''

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-900 text-sm">{meta.label}</p>
          {meta.descripcion && (
            <p className="text-xs text-slate-500 mt-1 flex items-start gap-1">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              <span>{meta.descripcion}</span>
            </p>
          )}
        </div>

        {!editando && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded">
              {item.valor}{sufijo}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setEditando(true)} className="h-8 w-8 p-0">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {editando && (
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1 flex-1 max-w-[200px]">
            <Input
              type={meta.tipo ? 'number' : 'text'}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="h-9 text-sm"
              min={0}
            />
            {sufijo && <span className="text-sm text-slate-500">{sufijo}</span>}
          </div>
          <Button size="sm" onClick={guardar} disabled={isPending} className="gap-1.5">
            <Check className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Guardar</span>
          </Button>
          <Button size="sm" variant="outline" onClick={cancelar} disabled={isPending} className="gap-1.5">
            <X className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Cancelar</span>
          </Button>
        </div>
      )}
    </div>
  )
}

export function ConfiguracionPanel({ configuracion }: Props) {
  // Mostrar primero las claves conocidas, después las "extras"
  const conocidas = Object.keys(LABELS)
  const ordenadas = [
    ...conocidas.map((k) => configuracion.find((c) => c.clave === k)).filter(Boolean) as ConfiguracionItem[],
    ...configuracion.filter((c) => !conocidas.includes(c.clave)),
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Parámetros operativos</CardTitle>
        <CardDescription>
          Valores que controlan cómo se comporta el sistema. Editalos cuando cambien las
          reglas de la cooperadora — los cambios aplican en la próxima ejecución del proceso
          que los usa (cron mensual, registro de pagos, etc.).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {ordenadas.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">No hay parámetros configurados.</p>
        ) : (
          ordenadas.map((item) => <ConfigRow key={item.clave} item={item} />)
        )}
      </CardContent>
    </Card>
  )
}
