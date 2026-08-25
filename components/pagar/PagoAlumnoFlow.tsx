'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { Search, ArrowRight, CreditCard, GraduationCap, Loader2, ChevronLeft, Repeat, Building2, Copy, Check, HandCoins } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/phone-input'
import { formatMonto } from '@/lib/utils'
import { buscarAlumnoParaAporte, crearPagoMensualAlumno, crearPagoAnualAlumno, crearDebitoAlumno, crearPagoLibreAlumno, sugerirAlumnos, getAlumnoParaAportePorId, type Sugerencia, type AlumnoParaAporte, type DatosTransferencia } from '@/app/pagar/actions'

export function PagoAlumnoFlow({ transferencia }: { transferencia: DatosTransferencia }) {
  const [term, setTerm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [resultados, setResultados] = useState<AlumnoParaAporte[] | null>(null)
  const [elegido, setElegido] = useState<AlumnoParaAporte | null>(null)
  const [buscando, startBuscar] = useTransition()
  const [pagando, startPagar] = useTransition()
  const [mostrarDebito, setMostrarDebito] = useState(false)
  const [debEmail, setDebEmail] = useState('')
  const [debTel, setDebTel] = useState('')
  const [mostrarLibre, setMostrarLibre] = useState(false)
  const [montoLibre, setMontoLibre] = useState('')
  const [mostrarTransfer, setMostrarTransfer] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([])
  const [mostrarSug, setMostrarSug] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sugerencias en vivo mientras escribe (con debounce para no saturar).
  useEffect(() => {
    if (elegido) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const t = term.trim()
    if (t.length < 2) { setSugerencias([]); return }
    debounceRef.current = setTimeout(async () => {
      const res = await sugerirAlumnos(t)
      setSugerencias(res)
      setMostrarSug(true)
    }, 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [term, elegido])

  const elegirSugerencia = (s: Sugerencia) => {
    setMostrarSug(false)
    setSugerencias([])
    setError(null)
    startBuscar(async () => {
      const r = await getAlumnoParaAportePorId(s.id)
      if (r.error) { setError(r.error); return }
      if (r.alumno) setElegido(r.alumno)
    })
  }

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

  const activarDebito = (alumnoId: string) => {
    setError(null)
    if (!debEmail.trim().includes('@')) { setError('Ingresá un email válido para el débito.'); return }
    startPagar(async () => {
      const r = await crearDebitoAlumno(alumnoId, debEmail, debTel)
      if (r.error) { setError(r.error); return }
      if (r.initPoint) window.location.href = r.initPoint
    })
  }

  const pagarLibre = (alumnoId: string) => {
    setError(null)
    const monto = Number(montoLibre)
    if (!monto || monto < 100) { setError('Ingresá un monto de al menos $100.'); return }
    startPagar(async () => {
      const r = await crearPagoLibreAlumno(alumnoId, monto)
      if (r.error) { setError(r.error); return }
      if (r.initPoint) window.location.href = r.initPoint
    })
  }

  const copiar = async (valor: string, campo: string) => {
    try {
      await navigator.clipboard.writeText(valor)
      setCopiado(campo)
      setTimeout(() => setCopiado(null), 2000)
    } catch {}
  }

  const volver = () => {
    setElegido(null); setResultados(null)
    setMostrarDebito(false); setDebEmail(''); setDebTel('')
    setMostrarTransfer(false)
    setMostrarLibre(false); setMontoLibre('')
    setSugerencias([]); setMostrarSug(false); setTerm('')
  }

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

            {/* Aporte de monto libre: colaborar con lo que se pueda */}
            <div className="pt-3 border-t border-slate-100">
              {!mostrarLibre ? (
                <button
                  type="button"
                  onClick={() => { setMostrarLibre(true); setError(null) }}
                  disabled={pagando}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 hover:border-slate-300 py-2.5 text-sm font-medium text-slate-700 transition-colors disabled:opacity-50"
                >
                  <HandCoins className="h-4 w-4" />
                  Colaborar con otro monto
                </button>
              ) : (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Aporte voluntario</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Colaborá con el monto que puedas. Todo suma. 💚
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="monto-libre" className="text-xs">Monto a aportar</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                      <Input
                        id="monto-libre"
                        type="number"
                        inputMode="numeric"
                        min={100}
                        step={100}
                        value={montoLibre}
                        onChange={(e) => setMontoLibre(e.target.value)}
                        placeholder="5000"
                        className="pl-6"
                      />
                    </div>
                    {/* Atajos rápidos */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[2000, 5000, 10000, 20000].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMontoLibre(String(m))}
                          className="px-2.5 py-1 rounded-md border border-slate-200 bg-white text-xs text-slate-600 hover:border-slate-400 hover:text-slate-900 transition-colors"
                        >
                          {formatMonto(m)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => { setMostrarLibre(false); setMontoLibre(''); setError(null) }}
                      disabled={pagando}
                    >
                      Cancelar
                    </Button>
                    <Button
                      className="flex-1 gap-1.5"
                      onClick={() => pagarLibre(elegido.id)}
                      disabled={pagando || !montoLibre}
                    >
                      {pagando ? <><Loader2 className="h-4 w-4 animate-spin" /> …</> : 'Aportar'}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Débito automático */}
            <div className="pt-3 border-t border-slate-100">
              {!mostrarDebito ? (
                <button
                  type="button"
                  onClick={() => { setMostrarDebito(true); setError(null) }}
                  disabled={pagando}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 hover:border-slate-300 py-2.5 text-sm font-medium text-slate-700 transition-colors disabled:opacity-50"
                >
                  <Repeat className="h-4 w-4" />
                  Activar débito automático
                </button>
              ) : (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Débito automático</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Cargás tu tarjeta una vez y el aporte de {formatMonto(elegido.montoMensual)} se
                      realiza solo cada mes. Lo podés cancelar cuando quieras desde Mercado Pago.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="deb-email" className="text-xs">Tu email *</Label>
                    <Input
                      id="deb-email"
                      type="email"
                      value={debEmail}
                      onChange={(e) => setDebEmail(e.target.value)}
                      placeholder="tu@email.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tu WhatsApp (opcional, para recibos)</Label>
                    <PhoneInput value={debTel} onChange={setDebTel} />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => { setMostrarDebito(false); setError(null) }}
                      disabled={pagando}
                    >
                      Cancelar
                    </Button>
                    <Button
                      className="flex-1 gap-1.5"
                      onClick={() => activarDebito(elegido.id)}
                      disabled={pagando || !debEmail.trim()}
                    >
                      {pagando ? <><Loader2 className="h-4 w-4 animate-spin" /> …</> : 'Activar'}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>
            )}

            {/* Transferencia directa (si la cooperadora la tiene configurada) */}
            {transferencia.habilitado && (
              <div className="pt-3 border-t border-slate-100">
                {!mostrarTransfer ? (
                  <button
                    type="button"
                    onClick={() => setMostrarTransfer(true)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 hover:border-slate-300 py-2.5 text-sm font-medium text-slate-700 transition-colors"
                  >
                    <Building2 className="h-4 w-4" />
                    Transferir a la cooperadora
                  </button>
                ) : (
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2.5">
                    <p className="text-sm font-semibold text-slate-900">Transferencia bancaria</p>
                    <p className="text-xs text-slate-600">
                      Transferí <strong>{formatMonto(elegido.montoMensual)}</strong> a esta cuenta. Guardá el
                      comprobante — tu aporte se registra cuando la cooperadora lo recibe.
                    </p>
                    {transferencia.alias && (
                      <DatoCopiable label="Alias" valor={transferencia.alias} campo="alias" copiado={copiado} onCopy={copiar} />
                    )}
                    {transferencia.cbu && (
                      <DatoCopiable label="CBU/CVU" valor={transferencia.cbu} campo="cbu" copiado={copiado} onCopy={copiar} />
                    )}
                    {transferencia.titular && (
                      <p className="text-xs text-slate-600"><span className="text-slate-400">Titular:</span> {transferencia.titular}</p>
                    )}
                    {transferencia.banco && (
                      <p className="text-xs text-slate-600"><span className="text-slate-400">Banco:</span> {transferencia.banco}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <p className="text-center text-[11px] text-slate-400">
              Con Mercado Pago pagás con tarjeta de cualquier banco, dinero en cuenta o efectivo (Rapipago/Pago Fácil). Tu aporte es voluntario y agradecido. 🔒
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
            onFocus={() => setMostrarSug(true)}
            placeholder="Empezá a escribir el nombre o el DNI…"
            className="pl-9"
            autoComplete="off"
            required
          />

          {/* Sugerencias en vivo */}
          {mostrarSug && sugerencias.length > 0 && (
            <div className="absolute z-20 left-0 right-0 top-full mt-1 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
              {sugerencias.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => elegirSugerencia(s)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900 truncate">{s.nombre}</span>
                    <span className="block text-xs text-slate-500">
                      {s.grado}{s.turno ? ` · ${s.turno}` : ''}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-300 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-slate-400">
          Tocá el nombre que aparece abajo para continuar.
        </p>
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

function DatoCopiable({
  label, valor, campo, copiado, onCopy,
}: {
  label: string
  valor: string
  campo: string
  copiado: string | null
  onCopy: (valor: string, campo: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-white border border-slate-200 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-slate-900 break-all">{valor}</p>
      </div>
      <button
        type="button"
        onClick={() => onCopy(valor, campo)}
        className="shrink-0 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
      >
        {copiado === campo ? (
          <><Check className="h-3.5 w-3.5 text-emerald-600" /> Copiado</>
        ) : (
          <><Copy className="h-3.5 w-3.5" /> Copiar</>
        )}
      </button>
    </div>
  )
}
