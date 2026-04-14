import { School } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { RegistroForm } from '@/components/registro/RegistroForm'

export const metadata = {
  title: 'Registrarse — Cooperadora Escolar',
}

export default function RegistroPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-11 w-11 rounded-xl bg-slate-900 flex items-center justify-center shadow">
            <School className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-lg leading-tight">Cooperadora Escolar</p>
            <p className="text-sm text-slate-500">Registrate para pagar las cuotas</p>
          </div>
        </div>

        <Card className="shadow-md">
          <CardContent className="pt-6">
            <RegistroForm />
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400 mt-4">
          ¿Ya tenés cuenta?{' '}
          <a href="/cuenta" className="underline hover:text-slate-600">
            Ingresá acá
          </a>
        </p>
      </div>
    </div>
  )
}
