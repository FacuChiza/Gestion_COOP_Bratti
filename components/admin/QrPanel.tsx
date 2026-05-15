'use client'

import { useState } from 'react'
import { Download, ExternalLink, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Panel admin para generar e imprimir el QR de la cooperadora.
 *
 * El QR apunta a /pagar (página pública con buscador por DNI). Lo genera
 * api.qrserver.com — no necesita librería ni pagar nada.
 *
 * Para imprimirlo: botón "Descargar PNG" → guarda el archivo. Después se
 * imprime y pega en la cartelera de la escuela.
 */
export function QrPanel() {
  const [copiado, setCopiado] = useState(false)

  // Detectar dominio actual del lado del cliente. SSR no tiene window.
  const baseUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : ''

  const urlPagar = baseUrl ? `${baseUrl}/pagar` : '/pagar'
  const tamanoQR = 600
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${tamanoQR}x${tamanoQR}&data=${encodeURIComponent(urlPagar)}&margin=20`

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(urlPagar)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // ignore
    }
  }

  const descargar = () => {
    const a = document.createElement('a')
    a.href = qrUrl
    a.download = 'qr-cooperadora-bratti.png'
    a.target = '_blank'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Panel principal: el QR */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 flex flex-col items-center justify-center">
        <div className="bg-white rounded-lg p-4 border border-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrUrl}
            alt="QR de la cooperadora"
            width={300}
            height={300}
            className="w-[300px] h-[300px]"
          />
        </div>
        <p className="mt-4 text-xs text-slate-500 text-center max-w-xs">
          Cualquier padre que escanee este QR llega a la página para realizar su aporte
          ingresando su DNI.
        </p>
      </div>

      {/* Acciones e info */}
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
          <h3 className="font-semibold text-slate-900">Imprimirlo y pegarlo en la escuela</h3>
          <p className="text-sm text-slate-600">
            Descargá el QR en alta resolución, lo imprimís y lo colocás en la cartelera de
            la cooperadora. Cualquiera lo puede escanear desde su celular para pagar.
          </p>
          <Button onClick={descargar} className="w-full gap-2">
            <Download className="h-4 w-4" />
            Descargar QR (PNG alta resolución)
          </Button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
          <h3 className="font-semibold text-slate-900">O compartir el link directo</h3>
          <p className="text-sm text-slate-600">
            Si preferís mandarlo por WhatsApp o email, copiá el link:
          </p>
          <div className="flex gap-2">
            <code className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-slate-700 break-all">
              {urlPagar}
            </code>
            <Button variant="outline" size="sm" onClick={copiar} className="gap-1.5 shrink-0">
              {copiado ? (
                <><Check className="h-3.5 w-3.5 text-emerald-600" /> Copiado</>
              ) : (
                <><Copy className="h-3.5 w-3.5" /> Copiar</>
              )}
            </Button>
          </div>
          <a
            href={urlPagar}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
          >
            <ExternalLink className="h-3 w-3" />
            Abrir en una nueva pestaña para probarlo
          </a>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs text-amber-800">
            <strong>Tip:</strong> El padre solo necesita su DNI para identificarse.
            Si todavía no está dado de alta como pagador, le aparece un mensaje
            invitándolo a registrarse primero.
          </p>
        </div>
      </div>
    </div>
  )
}
