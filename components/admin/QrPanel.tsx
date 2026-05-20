'use client'

import { useState } from 'react'
import { Download, ExternalLink, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Panel admin para generar e imprimir el QR de la cooperadora.
 *
 * El QR apunta a /pagar (página pública con buscador por DNI). Lo genera
 * api.qrserver.com — no necesita librería ni pagar nada.
 */
export function QrPanel() {
  const [copiado, setCopiado] = useState(false)

  // Detectar dominio actual del lado del cliente. SSR no tiene window.
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const urlPagar = baseUrl ? `${baseUrl}/pagar` : '/pagar'
  // El QR se baja en JPG alta resolución para que se imprima nítido.
  // En pantalla se muestra una versión más chica también en JPG (consistente).
  const qrDownloadUrl = `https://api.qrserver.com/v1/create-qr-code/?size=800x800&format=jpg&data=${encodeURIComponent(urlPagar)}&margin=20`
  const qrDisplayUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&format=jpg&data=${encodeURIComponent(urlPagar)}&margin=10`

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(urlPagar)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {}
  }

  const descargar = async () => {
    // Algunos navegadores ignoran el atributo download cuando el href es
    // de otro origen. Para garantizar la descarga forzada como JPG,
    // bajamos el blob primero y armamos un object URL local.
    try {
      const res = await fetch(qrDownloadUrl)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'qr-cooperadora-bratti.jpg'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // Fallback: abrir el QR directo en nueva pestaña, el user lo guarda
      // con click derecho → Guardar imagen.
      window.open(qrDownloadUrl, '_blank', 'noopener')
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      {/* Panel principal: el QR */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6 flex flex-col items-center justify-center">
        <div className="bg-white rounded-lg p-2 sm:p-4 border border-slate-100 w-full max-w-[280px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDisplayUrl}
            alt="QR de la cooperadora"
            className="w-full h-auto block"
          />
        </div>
        <p className="mt-3 sm:mt-4 text-xs text-slate-500 text-center max-w-xs">
          Cualquier padre que escanee este QR llega a la página para realizar su aporte
          ingresando su DNI.
        </p>
      </div>

      {/* Acciones e info */}
      <div className="space-y-3 sm:space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
          <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
            Imprimirlo y pegarlo en la escuela
          </h3>
          <p className="text-xs sm:text-sm text-slate-600">
            Descargá el QR en alta resolución, imprimilo y colocalo en la cartelera.
          </p>
          <Button onClick={descargar} className="w-full gap-2">
            <Download className="h-4 w-4 shrink-0" />
            <span className="truncate">Descargar QR (JPG)</span>
          </Button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
          <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
            O compartir el link directo
          </h3>
          <p className="text-xs sm:text-sm text-slate-600">
            Si preferís mandarlo por WhatsApp o email, copiá el link:
          </p>
          {/* En mobile: link arriba, botón abajo. En desktop: lado a lado. */}
          <div className="flex flex-col sm:flex-row gap-2">
            <code className="flex-1 min-w-0 text-xs bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-slate-700 break-all">
              {urlPagar}
            </code>
            <Button variant="outline" size="sm" onClick={copiar} className="gap-1.5 sm:shrink-0 sm:w-auto">
              {copiado ? (
                <><Check className="h-3.5 w-3.5 text-emerald-600" /> Copiado</>
              ) : (
                <><Copy className="h-3.5 w-3.5" /> Copiar link</>
              )}
            </Button>
          </div>
          <a
            href={urlPagar}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span>Abrir para probarlo</span>
          </a>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 sm:p-4">
          <p className="text-xs text-amber-800">
            <strong>Tip:</strong> el padre solo necesita su DNI para identificarse.
            Si no está dado de alta, le aparece un mensaje invitándolo a registrarse.
          </p>
        </div>
      </div>
    </div>
  )
}
