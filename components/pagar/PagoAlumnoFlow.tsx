'use client'

import { useState, useTransition } from 'react'
import { Search, ArrowRight, CreditCard, GraduationCap, Loader2, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatMonto } from '@/lib/utils'
import { buscarAlumnoParaAporte, crearPagoMensualAlumno, crearPagoAnualAlumno, type AlumnoParaAporte } from '@/app/pagar/actions'

export function PagoAlumnoFlow() {
  const [term, setTerm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [resultados, setResultados] = useState<AlumnoParaAporte[] | null>(null)
  const [elegido, setElegido] = useState<AlumnoParaAporte | null>(null)
  const [buscando, startBuscar] = useTransition()
  const [pagando, startPagar] = useTransition()

  const buscar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setResultados(null)
    setElegido(null)
    startBuscar(async () => {
      const r = await buscarAlumnoParaAporte(term)
      if (r.error) { setError(r.error); return }
      const lista = r.alumnos ?? []
      if (lista.length === 1) setElegido(lista[0])
      else setResultados(lista)
    })
  }

  const pagar = (alumnoId: string, modalidad: 'mensual' | 'anual') => {
    setError(null)
    startPagar(async () => {
      const r = modalidad === 'anual'
        ? await crearPagoAnualAlumno(alumnoId)
        : await crearPagoMensualAlumno(alumnoId)
      if (r.error) { setError(r.error); return }
      if (r.initPoint) window.location.href = r.initPoint
    })
  }

  const volver = () => { setElegido(null); setResultados(null) }

  // ── Card del alumno elegido → pagar ─────────────────────────
  if (elegido) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={volver}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Buscar otro
        </button>

        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 text-white px-5 py-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">{elegido.nombre}</p>
              <p className="text-sm text-white/70">
                {elegido.grado}{elegido.turno ? ` · ${elegido.turno}` : ''}
              </p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Aporte mensual</p>
                {elegido.esFamilia && (
                  <p className="text-xs text-emerald-600 font-medium">Precio hermanos aplicado</p>
                )}
              </div>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">
                {formatMonto(elegido.montoMensual)}
              </p>
            </div>

            <Button
              className="w-full h-12 gap-2 text-base bg-[#009EE3] hover:bg-[#0082BF]"
              onClick={() => pagar(elegido.id, 'mensual')}
              disabled={pagando}
            >
              {pagando ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Redirigiendo…</>
              ) : (
                <><CreditCard className="h-5 w-5" /> Pagar este mes · {formatMonto(elegido.montoMensual)}</>
              )}
            </Button>

            {/* Aporte anual (pago único del ciclo lectivo) */}
            <button
              type="button"
              onClick={() => pagar(elegido.id, 'anual')}
              disabled={pagando}
              className="w-full flex items-center justify-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 py-1.5 disabled:opacity-50"
            >
              o pagar el año completo · <span className="font-semibold">{formatMonto(elegido.montoAnual)}</span>
            </button>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>
            )}

            <p className="text-center text-[11px] text-slate-400">
              🔒 Vas al sitio seguro de Mercado Pago. Tu aporte es voluntario y agradecido.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Lista de resultados (varios con el mismo nombre) ────────
  if (resultados && resultados.length > 1) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={volver}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Volver
        </button>
        <p className="text-sm text-slate-600">Encontramos varios. Tocá el que corresponda:</p>
        <div className="space-y-2">
          {resultados.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setElegido(a)}
              className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-slate-400 hover:bg-slate-50 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-900 truncate">{a.nombre}</p>
                <p className="text-xs text-slate-500">{a.grado}{a.turno ? ` · ${a.turno}` : ''}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Formulario de búsqueda inicial ──────────────────────────
  return (
    <form onSubmit={buscar} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="term">DNI o nombre del alumno/a</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            id="term"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Ej: 45123456 o Juan Pérez"
            className="pl-9"
            autoComplete="off"
            required
          />
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>
      )}

      <Button type="submit" className="w-full gap-2" disabled={buscando || term.trim().length < 3}>
        {buscando ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Buscando…</>
        ) : (
          <>Continuar <ArrowRight className="h-4 w-4" /></>
        )}
      </Button>
    </form>
  )
}
