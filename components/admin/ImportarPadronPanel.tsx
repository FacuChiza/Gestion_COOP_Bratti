'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Upload, FileCheck2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { importarPadron, type FilaPadron } from '@/app/admin/actions'

// Parser CSV robusto: respeta campos entre comillas con comas adentro.
function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const t = text.replace(/^﻿/, '') // sacar BOM
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (inQuotes) {
      if (c === '"') {
        if (t[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (c === '\r') { /* ignore */ }
      else field += c
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows
}

function normalizar(s: string) {
  return s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function ImportarPadronPanel() {
  const [filas, setFilas] = useState<FilaPadron[] | null>(null)
  const [nombreArchivo, setNombreArchivo] = useState('')
  const [errorParse, setErrorParse] = useState<string | null>(null)
  const [cierre, setCierre] = useState(false)
  const [isPending, startTransition] = useTransition()

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorParse(null); setFilas(null)
    const file = e.target.files?.[0]
    if (!file) return
    setNombreArchivo(file.name)
    const text = await file.text()
    const matriz = parseCSV(text).filter((r) => r.some((c) => c.trim() !== ''))
    if (matriz.length < 2) { setErrorParse('El archivo está vacío o no tiene filas de datos.'); return }

    const header = matriz[0].map(normalizar)
    const idxNombre = header.findIndex((h) => h.includes('nombre'))
    const idxDni    = header.findIndex((h) => h === 'dni' || h.includes('dni'))
    const idxCurso  = header.findIndex((h) => h.includes('curso') || h.includes('grado'))
    if (idxNombre < 0 || idxDni < 0 || idxCurso < 0) {
      setErrorParse('El CSV debe tener columnas: nombre, dni, curso.')
      return
    }

    const parsed: FilaPadron[] = matriz.slice(1).map((r) => ({
      nombre: (r[idxNombre] ?? '').trim(),
      dni:    (r[idxDni] ?? '').trim(),
      curso:  (r[idxCurso] ?? '').trim(),
    })).filter((f) => f.nombre.length >= 2)
    setFilas(parsed)
  }

  const importar = () => {
    if (!filas) return
    if (cierre && !confirm(
      'MODO CIERRE DE CICLO\n\nSe darán de BAJA todos los alumnos activos que NO figuren en este archivo ' +
      '(egresados, que se fueron o cambiaron de escuela). Su historial se conserva.\n\n¿Continuar?'
    )) return
    startTransition(async () => {
      const r = await importarPadron(filas, cierre)
      toast.success(
        `Importado: ${r.creados} nuevos, ${r.actualizados} actualizados` +
        (r.omitidos ? `, ${r.omitidos} duplicados omitidos` : '') +
        (r.dadosDeBaja ? `, ${r.dadosDeBaja} dados de baja` : '') +
        (r.errores ? `, ${r.errores} con error` : ''),
      )
      setFilas(null); setNombreArchivo(''); setCierre(false)
    })
  }

  const conDni = filas?.filter((f) => f.dni.replace(/\D/g, '').length >= 6).length ?? 0
  const sinDni = (filas?.length ?? 0) - conDni

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
        <h3 className="font-semibold text-slate-900">Importar padrón de alumnos</h3>
        <p className="text-sm text-slate-600">
          Subí un archivo <strong>CSV</strong> con las columnas <code className="text-xs bg-slate-100 px-1 rounded">nombre</code>,
          {' '}<code className="text-xs bg-slate-100 px-1 rounded">dni</code> y
          {' '}<code className="text-xs bg-slate-100 px-1 rounded">curso</code>. Los alumnos que ya existan
          (mismo DNI) se actualizan; los nuevos se agregan. El turno se deduce del curso
          (los que empiezan con “Adultos” quedan en turno Noche).
        </p>

        <label className="flex items-center justify-center gap-2 w-full h-24 rounded-lg border-2 border-dashed border-slate-300 hover:border-slate-400 cursor-pointer transition-colors text-slate-500">
          <Upload className="h-5 w-5" />
          <span className="text-sm">{nombreArchivo || 'Elegí el archivo CSV'}</span>
          <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
        </label>

        {errorParse && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {errorParse}
          </p>
        )}
      </div>

      {filas && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center gap-2 text-slate-900">
            <FileCheck2 className="h-5 w-5 text-emerald-600" />
            <span className="font-semibold">{filas.length} alumnos listos para importar</span>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="text-slate-600">Con DNI: <strong className="text-slate-900">{conDni}</strong></span>
            {sinDni > 0 && <span className="text-amber-600">Sin DNI: <strong>{sinDni}</strong> (se cargan igual, revisá luego)</span>}
          </div>

          {/* Vista previa (primeras 8) */}
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Nombre</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">DNI</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-600">Curso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filas.slice(0, 8).map((f, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 truncate max-w-[240px]">{f.nombre}</td>
                    <td className="px-3 py-1.5 text-slate-600">{f.dni || <span className="text-amber-500">—</span>}</td>
                    <td className="px-3 py-1.5 text-slate-600">{f.curso}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filas.length > 8 && (
              <p className="text-xs text-slate-400 px-3 py-2 bg-slate-50">… y {filas.length - 8} más</p>
            )}
          </div>

          {/* Modo cierre de ciclo */}
          <label className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={cierre}
              onChange={(e) => setCierre(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 mt-0.5"
            />
            <span className="text-xs text-amber-800">
              <strong>Modo cierre de ciclo.</strong> Dar de baja a los alumnos activos que NO figuren en
              este archivo (egresados, que se fueron o se cambiaron). Usalo solo cuando subís el
              <strong> padrón completo del año</strong>. Su historial se conserva; para un alta puntual
              a mitad de año, dejalo destildado.
            </span>
          </label>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setFilas(null); setNombreArchivo(''); setCierre(false) }} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={importar} disabled={isPending} className="gap-2">
              {isPending ? 'Importando…' : (<><CheckCircle2 className="h-4 w-4" /> Importar {filas.length} alumnos</>)}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
