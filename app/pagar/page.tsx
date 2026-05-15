/**
 * /pagar — PÁGINA PÚBLICA, sin login.
 *
 * Punto de entrada del QR que se imprime en la escuela. El padre escanea,
 * pone su DNI, y va directo al flujo de pago de su pagador (mismo destino
 * que el link personal /aporte/[pagadorId]).
 *
 * Solo expone datos mínimos antes de identificar (no expone nada hasta
 * que matchea el DNI). Después del match, redirige a /aporte/[pagadorId]
 * que ya tiene toda la lógica de pago + activar débito automático.
 */

import { Logo } from '@/components/Logo'
import { BuscarPagadorForm } from '@/components/pagar/BuscarPagadorForm'

export const metadata = {
  title: 'Aportar — Cooperadora Bratti',
}

export const dynamic = 'force-dynamic'

export default function PagarPublicoPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <Logo size={56} subtitulo="Cooperadora" />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Realizá tu aporte</h1>
            <p className="text-sm text-slate-500 mt-1">
              Ingresá tu DNI para ver tus aportes y colaborar.
            </p>
          </div>

          <BuscarPagadorForm />

          <div className="text-center text-xs text-slate-400 pt-2 border-t border-slate-100">
            ¿Aún no estás registrado/a?{' '}
            <a href="/registro" className="text-slate-600 underline hover:text-slate-900">
              Registrate acá
            </a>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          🔒 Tu DNI solo se usa para identificarte. No se comparte con terceros.
        </p>
      </div>
    </div>
  )
}
