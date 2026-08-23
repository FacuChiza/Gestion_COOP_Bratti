/**
 * /pagar — PÁGINA PÚBLICA, sin login ni registro.
 *
 * El padre pone el DNI o el nombre del alumno y le aparece directo el
 * aporte para pagar. Es el destino del QR de la escuela.
 * MercadoPago vuelve acá con ?pago=ok|error|pendiente.
 */

import { CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { PagoAlumnoFlow } from '@/components/pagar/PagoAlumnoFlow'
import { getDatosTransferencia } from './actions'

export const metadata = {
  title: 'Aportar — Cooperadora Bratti',
}

export const dynamic = 'force-dynamic'

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <Logo size={56} subtitulo="Cooperadora" />
        </div>
        {children}
        <p className="text-center text-xs text-slate-400 mt-4">
          Cooperadora Escolar · Escuela Técnica N° 34 Bratti
        </p>
      </div>
    </div>
  )
}

export default async function PagarPublicoPage({
  searchParams,
}: {
  searchParams: { pago?: string }
}) {
  const banner = searchParams.pago
  const transferencia = await getDatosTransferencia()

  if (banner === 'ok') {
    return (
      <Layout>
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-6 text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-lg">¡Gracias por colaborar! 💚</p>
            <p className="text-sm text-slate-500 mt-1">
              Tu aporte fue procesado. En unos minutos te llega el comprobante.
            </p>
          </div>
          <a href="/pagar" className="inline-flex text-sm text-slate-500 hover:text-slate-700">Volver</a>
        </div>
      </Layout>
    )
  }

  if (banner === 'pendiente') {
    return (
      <Layout>
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-6 text-center space-y-4">
          <Clock className="h-12 w-12 text-amber-500 mx-auto" />
          <p className="font-semibold text-slate-900">Aporte en proceso</p>
          <p className="text-sm text-slate-500">Mercado Pago está confirmando el pago. Te avisamos apenas se acredite.</p>
          <a href="/pagar" className="text-sm text-slate-500 hover:text-slate-700">Volver</a>
        </div>
      </Layout>
    )
  }

  if (banner === 'error') {
    return (
      <Layout>
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6 text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <p className="font-semibold text-slate-900">El pago no se completó</p>
          <p className="text-sm text-slate-500">Podés intentarlo de nuevo.</p>
          <a href="/pagar" className="inline-flex h-9 px-5 items-center justify-center rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-700">
            Reintentar
          </a>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Realizá tu aporte</h1>
          <p className="text-sm text-slate-500 mt-1">
            Poné el DNI o el nombre del alumno/a y te aparece el aporte para pagar. Sin registro.
          </p>
        </div>
        <PagoAlumnoFlow transferencia={transferencia} />
      </div>
    </Layout>
  )
}
