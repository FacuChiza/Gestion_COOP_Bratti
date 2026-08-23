'use client'

import { useState } from 'react'
import { Pencil, UserCog } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatMes, formatMonto } from '@/lib/utils'
import type { AlumnoConEstado, Plan, Pagador } from '@/types'
import { PaymentFormDialog } from './PaymentFormDialog'
import { LinkPagoButton } from './LinkPagoButton'
import { EditStudentDialog } from './EditStudentDialog'
import { EditPagadorDialog } from './EditPagadorDialog'

type Props = {
  alumnos: AlumnoConEstado[]
  planes?: Plan[]
}

// Estado del aporte del mes actual. En el modelo padrón el badge se basa
// en la cuota del mes, no en si tiene suscripción.
const estadoBadge = (cuotaEstado: string | undefined | null) => {
  if (cuotaEstado === 'pagada')    return <Badge variant="success">Pagada</Badge>
  if (cuotaEstado === 'vencida')   return <Badge variant="danger">Vencida</Badge>
  if (cuotaEstado === 'pendiente') return <Badge variant="warning">Pendiente</Badge>
  return <Badge variant="outline">Sin generar</Badge>
}

// Extraer cursos únicos de la lista
function cursosUnicos(alumnos: AlumnoConEstado[]) {
  const set = new Set(alumnos.map(a => a.grado))
  return ['', ...Array.from(set).sort()]
}

export function StudentList({ alumnos, planes = [] }: Props) {
  const [busqueda, setBusqueda]   = useState('')
  const [cursoFiltro, setCursoFiltro] = useState('')
  const [turnoFiltro, setTurnoFiltro] = useState('')
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState<AlumnoConEstado | null>(null)
  const [alumnoEdit, setAlumnoEdit]     = useState<AlumnoConEstado | null>(null)
  const [pagadorEdit, setPagadorEdit]   = useState<Pagador | null>(null)
  const [mostrarInactivos, setMostrarInactivos] = useState(false)

  const filtrados = alumnos.filter((a) => {
    const matchActivo = mostrarInactivos ? true : a.activo !== false
    const matchTexto =
      a.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      a.grado.toLowerCase().includes(busqueda.toLowerCase())
    const matchCurso = !cursoFiltro || a.grado === cursoFiltro
    const matchTurno = !turnoFiltro || (a.turno ?? '').toLowerCase() === turnoFiltro.toLowerCase()
    return matchActivo && matchTexto && matchCurso && matchTurno
  })

  const cursos = cursosUnicos(alumnos)

  const ahora = new Date()
  const mesActual = ahora.getMonth() + 1
  const añoActual = ahora.getFullYear()

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {/* Búsqueda — siempre full width arriba */}
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="flex h-9 w-full sm:max-w-xs rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        />

        {/* Filtros + toggle + contador en una sola línea responsive */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro por curso */}
          <select
            value={cursoFiltro}
            onChange={e => setCursoFiltro(e.target.value)}
            className="h-9 flex-1 min-w-[140px] sm:flex-none rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
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
            className="h-9 flex-1 min-w-[140px] sm:flex-none rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <option value="">Todos los turnos</option>
            <option value="Mañana">Mañana</option>
            <option value="Noche">Noche</option>
          </select>

          <label className="flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap">
            <input
              type="checkbox"
              checked={mostrarInactivos}
              onChange={(e) => setMostrarInactivos(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300"
            />
            Mostrar inactivos
          </label>

          <span className="text-xs sm:text-sm text-slate-500 ml-auto whitespace-nowrap">
            {filtrados.length} estudiantes
          </span>
        </div>
      </div>

      {/* Tabla en md+, cards en mobile */}
      <div className="hidden md:block rounded-lg border border-slate-200 overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Alumno</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Grado / Turno</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Pagador</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">
                {formatMes(mesActual, añoActual)}
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Aportes pendientes</th>
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
              <tr
                key={alumno.id}
                className={`hover:bg-slate-50 transition-colors ${alumno.activo === false ? 'opacity-50' : ''}`}
              >
                <td className="px-4 py-3 font-medium">
                  {alumno.nombre}
                  {alumno.activo === false && (
                    <span className="ml-2 text-xs text-slate-400">(inactivo)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {alumno.grado}
                  {alumno.turno && <span className="text-slate-400"> · {alumno.turno}</span>}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {alumno.pagadores?.nombre ?? <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-3">
                  {estadoBadge(alumno.cuota_actual?.estado)}
                  {alumno.cuota_actual && (
                    <span className="ml-2 text-xs text-slate-400">
                      {formatMonto(alumno.cuota_actual.monto)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {alumno.cuotas_deuda > 0 ? (
                    <span className="text-red-600 font-medium">{alumno.cuotas_deuda} aporte{alumno.cuotas_deuda !== 1 ? 's' : ''}</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setAlumnoEdit(alumno)}
                      title="Editar alumno / cambiar plan / desactivar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {alumno.pagadores && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPagadorEdit(alumno.pagadores!)}
                        title="Editar pagador"
                      >
                        <UserCog className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {alumno.pagador_id && (
                      <LinkPagoButton
                        pagadorId={alumno.pagador_id}
                        pagadorNombre={alumno.pagadores?.nombre}
                        pagadorTelefono={alumno.pagadores?.telefono}
                      />
                    )}
                    {alumno.cuotas_deuda > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAlumnoSeleccionado(alumno)}
                      >
                        Registrar aporte
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Cards verticales en mobile ────────────────────────────── */}
      <div className="md:hidden space-y-2">
        {filtrados.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-400">
            No hay alumnos registrados
          </div>
        )}
        {filtrados.map((alumno) => (
          <div
            key={alumno.id}
            className={`rounded-lg border border-slate-200 bg-white p-3 space-y-2 ${
              alumno.activo === false ? 'opacity-60' : ''
            }`}
          >
            {/* Cabecera: nombre + acciones rápidas */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900 text-sm truncate">
                  {alumno.nombre}
                  {alumno.activo === false && (
                    <span className="ml-1 text-xs text-slate-400 font-normal">(inactivo)</span>
                  )}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {alumno.grado}
                  {alumno.turno && <span> · {alumno.turno}</span>}
                </p>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => setAlumnoEdit(alumno)} className="h-7 w-7 p-0">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {alumno.pagadores && (
                  <Button size="sm" variant="ghost" onClick={() => setPagadorEdit(alumno.pagadores!)} className="h-7 w-7 p-0">
                    <UserCog className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Pagador */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Pagador</span>
              <span className="text-slate-700 truncate ml-2">
                {alumno.pagadores?.nombre ?? <span className="text-slate-400">—</span>}
              </span>
            </div>

            {/* Estado del mes */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">{formatMes(mesActual, añoActual)}</span>
              <div className="flex items-center gap-2">
                {estadoBadge(alumno.cuota_actual?.estado)}
                {alumno.cuota_actual && (
                  <span className="text-xs text-slate-400">{formatMonto(alumno.cuota_actual.monto)}</span>
                )}
              </div>
            </div>

            {/* Deuda */}
            {alumno.cuotas_deuda > 0 && (
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                <span className="text-red-600 font-semibold">
                  {alumno.cuotas_deuda} aporte{alumno.cuotas_deuda !== 1 ? 's' : ''} pendientes
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAlumnoSeleccionado(alumno)}
                  className="h-7 text-xs px-2"
                >
                  Registrar aporte
                </Button>
              </div>
            )}

            {/* Link pago */}
            {alumno.pagador_id && (
              <div className="pt-1 border-t border-slate-100">
                <LinkPagoButton
                  pagadorId={alumno.pagador_id}
                  pagadorNombre={alumno.pagadores?.nombre}
                  pagadorTelefono={alumno.pagadores?.telefono}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {alumnoSeleccionado && (
        <PaymentFormDialog
          alumno={alumnoSeleccionado}
          open={!!alumnoSeleccionado}
          onClose={() => setAlumnoSeleccionado(null)}
        />
      )}

      {alumnoEdit && (
        <EditStudentDialog
          alumno={alumnoEdit}
          planes={planes}
          open={!!alumnoEdit}
          onClose={() => setAlumnoEdit(null)}
        />
      )}

      {pagadorEdit && (
        <EditPagadorDialog
          pagador={pagadorEdit}
          open={!!pagadorEdit}
          onClose={() => setPagadorEdit(null)}
        />
      )}
    </div>
  )
}
