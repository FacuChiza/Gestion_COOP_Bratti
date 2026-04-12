import { redirect } from 'next/navigation'
import { LogOut, School } from 'lucide-react'
import { getDashboardData, logoutAction } from '@/app/cuenta/actions'
import { StudentCard } from '@/components/cuenta/StudentCard'
import { Button } from '@/components/ui/button'
import { formatMonto } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const data = await getDashboardData()

  if (!data) redirect('/cuenta')
  if (!data.pagador) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-600 mb-2">Tu usuario no tiene un pagador asociado.</p>
          <p className="text-sm text-slate-400">Contactá a la cooperadora para que te den de alta.</p>
          <form action={logoutAction} className="mt-4">
            <Button variant="outline" type="submit">Cerrar sesión</Button>
          </form>
        </div>
      </div>
    )
  }

  const { pagador, alumnos } = data

  const totalDeuda = alumnos.reduce((acc: number, a) => {
    const deuda = a.historial
      .filter((c: { estado: string }) => c.estado === 'pendiente' || c.estado === 'vencida')
      .reduce((s: number, c: { monto: number }) => s + c.monto, 0)
    return acc + deuda
  }, 0)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-slate-900 flex items-center justify-center">
              <School className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Hola, {pagador.nombre.split(' ')[0]}</p>
              <p className="text-xs text-slate-500">Cooperadora Escolar</p>
            </div>
          </div>

          <form action={logoutAction}>
            <Button variant="ghost" size="sm" type="submit" className="gap-2 text-slate-600">
              <LogOut className="h-4 w-4" />
              Salir
            </Button>
          </form>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Resumen de deuda */}
        {totalDeuda > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-5 py-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-red-800">Tenés cuotas pendientes</p>
              <p className="text-sm text-red-600">
                Acercate a la cooperadora para regularizar tu situación.
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-red-500">Total adeudado</p>
              <p className="text-xl font-bold text-red-700">{formatMonto(totalDeuda)}</p>
            </div>
          </div>
        )}

        {/* Lista de alumnos */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Mis alumnos
            <span className="ml-2 text-sm font-normal text-slate-500">
              ({alumnos.length} {alumnos.length === 1 ? 'alumno' : 'alumnos'})
            </span>
          </h2>

          {alumnos.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              No tenés alumnos asociados a tu cuenta.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {alumnos.map((alumno) => (
                <StudentCard key={alumno.id} alumno={alumno} />
              ))}
            </div>
          )}
        </div>

        {/* Info de contacto */}
        <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 text-sm text-slate-500">
          <p className="font-medium text-slate-700 mb-1">¿Necesitás ayuda?</p>
          <p>Contactá a la cooperadora para consultas sobre pagos o tu cuenta.</p>
        </div>
      </main>
    </div>
  )
}
