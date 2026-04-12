import { School } from 'lucide-react'
import { getAlumnosConEstado, getAlumnosConDeuda, getPlanes } from './actions'
import { AdminTabs } from '@/components/admin/AdminTabs'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const [alumnos, alumnosConDeuda, planes] = await Promise.all([
    getAlumnosConEstado(),
    getAlumnosConDeuda(3),
    getPlanes(),
  ])

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-slate-900 flex items-center justify-center">
              <School className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-slate-900">Panel Administrativo</h1>
              <p className="text-xs text-slate-500">Cooperadora Escolar</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span>
              {new Date().toLocaleDateString('es-AR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>
      </header>

      {/* Estadísticas rápidas */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Alumnos activos"
            value={alumnos.length}
            color="text-slate-900"
          />
          <StatCard
            label="Cuotas pagas este mes"
            value={alumnos.filter((a) => a.cuota_actual?.estado === 'pagada').length}
            color="text-emerald-600"
          />
          <StatCard
            label="Cuotas pendientes"
            value={alumnos.filter((a) => a.cuota_actual?.estado === 'pendiente').length}
            color="text-amber-600"
          />
          <StatCard
            label="Con 3+ meses deuda"
            value={alumnosConDeuda.length}
            color="text-red-600"
          />
        </div>

        <AdminTabs alumnos={alumnos} alumnosConDeuda={alumnosConDeuda} planes={planes} />
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 px-4 py-3 shadow-sm">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
