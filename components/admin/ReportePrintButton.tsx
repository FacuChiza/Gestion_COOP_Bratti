'use client'

import { Printer, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ReportePrintButton() {
  return (
    <div className="no-print flex items-center justify-between gap-2 mb-6">
      <a href="/admin" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Volver al panel
      </a>
      <Button onClick={() => window.print()} className="gap-2">
        <Printer className="h-4 w-4" />
        Descargar PDF
      </Button>
    </div>
  )
}
