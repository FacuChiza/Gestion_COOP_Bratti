'use client'

import { useState } from 'react'
import { Link2, Copy, Check, Printer, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

type Props = {
  pagadorId: string
  pagadorNombre?: string | null
  pagadorTelefono?: string | null
}

export function LinkPagoButton({ pagadorId, pagadorNombre, pagadorTelefono }: Props) {
  const [open, setOpen] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== 'undefined' ? window.location.origin : '')
  const link = `${baseUrl}/aporte/${pagadorId}`
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(link)}`

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      /* no-op */
    }
  }

  function imprimir() {
    const w = window.open('', '_blank', 'width=400,height=600')
    if (!w) return
    w.document.write(`
      <html>
        <head><title>Link de aporte - ${pagadorNombre ?? ''}</title></head>
        <body style="font-family: system-ui, sans-serif; text-align:center; padding:24px;">
          <h2 style="margin:0 0 8px;">Cooperadora Escolar</h2>
          <p style="margin:0 0 16px; color:#475569;">Aporte voluntario${pagadorNombre ? ` — ${pagadorNombre}` : ''}</p>
          <img src="${qrSrc}" alt="QR" style="display:block; margin:0 auto 12px;" />
          <p style="font-size:12px; word-break:break-all; color:#334155;">${link}</p>
          <p style="margin-top:24px; color:#64748b; font-size:13px;">Escaneá el código o ingresá al link para colaborar.</p>
        </body>
      </html>
    `)
    w.document.close()
    setTimeout(() => w.print(), 300)
  }

  function abrirWhatsApp() {
    const tel = (pagadorTelefono ?? '').replace(/[^\d]/g, '')
    const msg = encodeURIComponent(
      `Hola${pagadorNombre ? ` ${pagadorNombre}` : ''}! Te dejamos el link para que colabores con la Cooperadora Escolar de forma rápida y segura: ${link}`
    )
    const url = tel
      ? `https://wa.me/${tel}?text=${msg}`
      : `https://wa.me/?text=${msg}`
    window.open(url, '_blank')
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        title="Compartir link de aporte"
      >
        <Link2 className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link de aporte</DialogTitle>
            <DialogDescription>
              Compartí este código QR o link con {pagadorNombre ?? 'el pagador'} para que colabore directamente, sin registro.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrSrc}
              alt="Código QR"
              width={240}
              height={240}
              className="rounded-md border border-slate-200 bg-white"
            />
            <div className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs break-all text-slate-700 font-mono">
              {link}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" size="sm" onClick={copiar}>
              {copiado ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              {copiado ? 'Copiado' : 'Copiar'}
            </Button>
            <Button variant="outline" size="sm" onClick={abrirWhatsApp}>
              <MessageCircle className="h-4 w-4 mr-1" />
              WhatsApp
            </Button>
            <Button variant="outline" size="sm" onClick={imprimir}>
              <Printer className="h-4 w-4 mr-1" />
              Imprimir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
