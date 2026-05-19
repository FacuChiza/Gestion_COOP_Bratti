import { Logo } from '@/components/Logo'
import { Card, CardContent } from '@/components/ui/card'
import { AdminLoginForm } from '@/components/admin/AdminLoginForm'

export const metadata = {
  title: 'Acceso administrativo',
}

export const dynamic = 'force-dynamic'

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <Logo size={64} subtitulo="Cooperadora" />
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-5 sm:p-6 space-y-5">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Panel administrativo</h1>
              <p className="text-sm text-slate-500 mt-1">
                Acceso exclusivo para directivos de la cooperadora.
              </p>
            </div>
            <AdminLoginForm />
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400 mt-4">
          ¿Sos pagador? Ingresá al{' '}
          <a href="/cuenta" className="text-slate-600 underline hover:text-slate-900">
            portal de familias
          </a>
        </p>
      </div>
    </div>
  )
}
