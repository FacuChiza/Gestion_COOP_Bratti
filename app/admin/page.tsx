import { getAlumnosConEstado, getAlumnosConDeuda, getPlanes, getConfiguracion } from './actions'
import { AdminTabs } from '@/components/admin/AdminTabs'
import { Logo } from '@/components/Logo'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Panel Administrativo',
}

export default async function AdminPage() {
  const [alumnos, alumnosConDeuda, planes, configuracion] = await Promise.all([
    getAlumnosConEstado(),
    getAlumnosConDeuda(3),
    getPlanes(),
    getConfiguracion(),
  ])

  const alumnosActivos    = alumnos.filter((a) => a.activo !== false)
  const aportesRealizados = alumnosActivos.filter((a) => a.cuota_actual?.estado === 'pagada').length
  const aportesPendientes = alumnosActivos.filter((a) => a.cuota_actual?.estado === 'pendiente').length

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header con logo prominente ─────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-6">
              {/* Logo grande y prominente, que se luzca */}
              <Logo size={92} subtitulo={null} />
              <div className="border-l border-slate-200 pl-6 leading-tight">
                <h1 className="font-bold text-slate-900 text-xl tracking-tight">Panel Administrativo</h1>
                <p className="text-sm text-slate-500 mt-0.5">Cooperadora Escolar Aristides Bratti</p>
              </div>
            </div>
            <div className="text-xs text-slate-500 capitalize">
              {new Date().toLocaleDateString('es-AR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ── Stats compactas, en una franja horizontal ───────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6 overflow-hidden">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100">
            <StatBar label="Alumnos activos"         value={alumnosActivos.length}     accent="text-slate-900" />
            <StatBar label="Aportes este mes"        value={aportesRealizados}         accent="text-emerald-600" />
            <StatBar label="Aportes pendientes"      value={aportesPendientes}         accent="text-amber-600" />
            <StatBar label="Con 3+ aportes pendientes" value={alumnosConDeuda.length}  accent="text-red-600" />
          </div>
        </div>

        {/* ── Tabs principales del panel ───────────────────────────── */}
        <AdminTabs
          alumnos={alumnos}
          alumnosConDeuda={alumnosConDeuda}
          planes={planes}
          configuracion={configuracion}
        />
      </div>
    </div>
  )
}

function StatBar({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between md:flex-col md:items-start md:gap-0.5 transition-colors hover:bg-slate-50">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-xl md:text-2xl font-bold tabular-nums ${accent}`}>{value}</span>
    </div>
  )
}
