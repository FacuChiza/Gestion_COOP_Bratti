import { LogOut, FileText } from 'lucide-react'
import { getAlumnosConEstado, getAlumnosConDeuda, getPlanes, getConfiguracion, getResumenEconomico } from './actions'
import { logoutAdminAction } from './login/actions'
import { AdminTabs } from '@/components/admin/AdminTabs'
import { ResumenEconomico } from '@/components/admin/ResumenEconomico'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Panel Administrativo',
}

export default async function AdminPage() {
  const [alumnos, alumnosConDeuda, planes, configuracion, resumen] = await Promise.all([
    getAlumnosConEstado(),
    getAlumnosConDeuda(3),
    getPlanes(),
    getConfiguracion(),
    getResumenEconomico(),
  ])

  const alumnosActivos = alumnos.filter((a) => a.activo !== false)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header con logo prominente ─────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-6 min-w-0">
              {/* Mobile: logo más chico (60), desktop: 92 */}
              <div className="hidden sm:block">
                <Logo size={92} subtitulo={null} />
              </div>
              <div className="sm:hidden">
                <Logo size={56} subtitulo={null} />
              </div>
              <div className="border-l border-slate-200 pl-3 sm:pl-6 leading-tight min-w-0">
                <h1 className="font-bold text-slate-900 text-base sm:text-xl tracking-tight truncate">
                  Panel Administrativo
                </h1>
                <p className="hidden sm:block text-sm text-slate-500 mt-0.5">
                  Cooperadora Escolar Aristides Bratti
                </p>
                <p className="sm:hidden text-xs text-slate-500">Cooperadora Bratti</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {/* Fecha solo en desktop */}
              <div className="hidden md:block text-xs text-slate-500 capitalize">
                {new Date().toLocaleDateString('es-AR', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="gap-1.5"
                title="Reporte anual en PDF"
              >
                <a href="/admin/reporte">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Reporte PDF</span>
                </a>
              </Button>
              <form action={logoutAdminAction}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-slate-500 hover:text-slate-900"
                  title="Cerrar sesión"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Salir</span>
                </Button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* ── Resumen unificado (dinero + este mes) ────────────────── */}
        <ResumenEconomico
          data={resumen}
          alumnosActivos={alumnosActivos.length}
          conDeuda={alumnosConDeuda.length}
        />

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
