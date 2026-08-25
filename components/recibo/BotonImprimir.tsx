'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Abre el diálogo de impresión; el usuario elige "Guardar como PDF". */
export function BotonImprimir() {
  return (
    <Button onClick={() => window.print()} className="gap-2">
      <Download className="h-4 w-4" />
      Descargar comprobante
    </Button>
  )
}
