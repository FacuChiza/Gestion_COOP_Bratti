'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatMes, formatMonto } from '@/lib/utils'
import type { AlumnoConEstado } from '@/types'
import { PaymentFormDialog } from './PaymentFormDialog'

type Props = {
  alumnos: AlumnoConEstado[]
}

const estadoBadge = (cuotaEstado: string | undefined | null, tieneSusc: boolean) => {
  if (!tieneSusc) return <Badge variant="outline">Sin suscripción</Badge>
  if (!cuotaEstado) return <Badge variant="secondary">Sin cuota</Badge>
  if (cuotaEstado === 'pagada') return <Badge variant="success">Pagada</Badge>
  if (cuotaEstado === 'vencida') return <Badge variant="danger">Vencida</Badge>
  return <Badge variant="warning">Pendiente</Badge>
}

// Extraer cursos únicos de la lista
function cursosUnicos(alumnos: AlumnoConEstado[]) {
  const set = new Set(alumnos.map(a => a.grado))
  return ['', ...Array.from(set).sort()]
}

export function StudentList({ alumnos }: Props) {
  const [busqueda, setBusqueda]   = useState('')
  const [cursoFiltro, setCursoFiltro] = useState('')
  const [turnoFiltro, setTurnoFiltro] = useState('')
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState<AlumnoConEstado | null>(null)

  const filtrados = alumnos.filter((a) => {
    const matchTexto =
      a.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      a.grado.toLowerCase().includes(busqueda.toLowerCase())
    const matchCurso = !cursoFiltro || a.grado === cursoFiltro
    const matchTurno = !turnoFiltro || (a.turno ?? '').toLowerCase() === turnoFiltro.toLowerCase()
    return matchTexto && matchCurso && matchTurno
  })

  const cursos = cursosUnicos(alumnos)

  const ahora = new Date()
  const mesActual = ahora.getMonth() + 1
  const añoActual = ahora.getFullYear()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="flex h-9 w-full max-w-xs rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        />

        {/* Filtro por curso */}
        <select
          value={cursoFiltro}
          onChange={e => setCursoFiltro(e.target.value)}
          className="h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          <option value="">Todos los cursos</option>
          {cursos.filter(Boolean).map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Filtro por turno */}
        <select
          value={turnoFiltro}
          onChange={e => setTurnoFiltro(e.target.value)}
          className="h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          <option value="">Todos los turnos</option>
          <option value="Mañana">Mañana</option>
          <option value="Noche">Noche</option>
        </select>

        <span className="text-sm text-slate-500 ml-auto">{filtrados.length} estudiantes</span>
      </div>

      <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Alumno</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Grado / Turno</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Pagador</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">
                {formatMes(mesActual, añoActual)}
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Deuda</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No hay alumnos registrados
                </td>
              </tr>
            )}
            {filtrados.map((alumno) => (
              <tr key={alumno.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium">{alumno.nombre}</td>
                <td className="px-4 py-3 text-slate-600">
                  {alumno.grado}
                  {alumno.turno && <span className="text-slate-400"> · {alumno.turno}</span>}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {alumno.pagadores?.nombre ?? <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-3">
                  {estadoBadge(alumno.cuota_actual?.estado, !!alumno.suscripcion_activa)}
                  {alumno.cuota_actual && (
                    <span className="ml-2 text-xs text-slate-400">
                      {formatMonto(alumno.cuota_actual.monto)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {alumno.cuotas_deuda > 0 ? (
                    <span className="text-red-600 font-medium">{alumno.cuotas_deuda} mes{alumno.cuotas_deuda !== 1 ? 'es' : ''}</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {alumno.cuotas_deuda > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAlumnoSeleccionado(alumno)}
                    >
                      Registrar pago
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {alumnoSeleccionado && (
        <PaymentFormDialog
          alumno={alumnoSeleccionado}
          open={!!alumnoSeleccionado}
          onClose={() => setAlumnoSeleccionado(null)}
        />
      )}
    </div>
  )
}
