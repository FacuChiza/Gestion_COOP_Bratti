'use client'

import { useState } from 'react'
import { Download, Users, UserCircle, Receipt, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'

const MESES = [
  { v: '', l: 'Todos los meses' },
  { v: '1', l: 'Enero' }, { v: '2', l: 'Febrero' }, { v: '3', l: 'Marzo' },
  { v: '4', l: 'Abril' }, { v: '5', l: 'Mayo' }, { v: '6', l: 'Junio' },
  { v: '7', l: 'Julio' }, { v: '8', l: 'Agosto' }, { v: '9', l: 'Septiembre' },
  { v: '10', l: 'Octubre' }, { v: '11', l: 'Noviembre' }, { v: '12', l: 'Diciembre' },
]

type Exportable = {
  tipo: 'alumnos' | 'pagadores' | 'aportes' | 'pagos'
  titulo: string
  descripcion: string
  icon: React.ComponentType<{ className?: string }>
  filtroFecha: boolean
}

const EXPORTS: Exportable[] = [
  {
    tipo: 'alumnos',
    titulo: 'Alumnos',
    descripcion: 'Listado completo de alumnos con su aportante asignado.',
    icon: Users,
    filtroFecha: false,
  },
  {
    tipo: 'pagadores',
    titulo: 'Aportantes',
    descripcion: 'Listado de aportantes (padres/tutores) con sus datos de contacto.',
    icon: UserCircle,
    filtroFecha: false,
  },
  {
    tipo: 'aportes',
    titulo: 'Aportes esperados',
    descripcion: 'Aportes generados por mes (pagados, pendientes, no realizados). Filtrable por mes/año.',
    icon: Receipt,
    filtroFecha: true,
  },
  {
    tipo: 'pagos',
    titulo: 'Aportes recibidos',
    descripcion: 'Histórico de aportes recibidos, con método (MP, efectivo, transferencia) y monto.',
    icon: CreditCard,
    filtroFecha: true,
  },
]

export function DataExportPanel() {
  const añoActual = new Date().getFullYear()
  const [año, setAño] = useState<string>(String(añoActual))
  const [mes, setMes] = useState<string>('')

  function descargar(tipo: string, conFiltro: boolean) {
    const params = new URLSearchParams()
    if (conFiltro) {
      if (año) params.set('año', año)
      if (mes) params.set('mes', mes)
    }
    const qs = params.toString()
    const url = `/api/admin/export/${tipo}${qs ? `?${qs}` : ''}`
    window.location.href = url
  }

  const años = Array.from({ length: 5 }, (_, i) => añoActual - i)

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="font-medium mb-2 text-sm sm:text-base">Filtros (para aportes esperados y recibidos)</h3>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-2">
          <select
            value={año}
            onChange={(e) => setAño(e.target.value)}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm"
          >
            <option value="">Todos los años</option>
            {años.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm"
          >
            {MESES.map((m) => (
              <option key={m.v} value={m.v}>{m.l}</option>
            ))}
          </select>
          <span className="col-span-2 text-xs text-slate-500 sm:ml-2">
            Solo se aplican a los reportes de aportes esperados y recibidos.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {EXPORTS.map((exp) => {
          const Icon = exp.icon
          return (
            <div
              key={exp.tipo}
              className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col gap-3"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-slate-100 p-2">
                  <Icon className="h-5 w-5 text-slate-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">{exp.titulo}</h4>
                  <p className="text-sm text-slate-500 mt-0.5">{exp.descripcion}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="self-start gap-2"
                onClick={() => descargar(exp.tipo, exp.filtroFecha)}
              >
                <Download className="h-4 w-4" />
                Descargar Excel
              </Button>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-slate-500">
        Los archivos se abren directamente con Excel o Google Sheets, ya formateados:
        encabezados fijos, filtros por columna y montos con formato de moneda.
      </p>
    </div>
  )
}
