'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Eye, EyeOff, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { registrarPagadorPublico } from '@/app/registro/actions'
import { cn, formatMonto } from '@/lib/utils'

// Cursos según turno
const CURSOS_MANANA = [
  '1° A', '1° B',
  '2° A', '2° B',
  '3° A', '3° B',
  '4° A', '4° B',
  '5° A', '5° B',
  '6°',
  '7°',
]

const CURSOS_NOCHE = ['1°', '2°', '3°']

const TURNOS = [
  { valor: 'Mañana', emoji: '🌅' },
  { valor: 'Noche',  emoji: '🌙' },
]

type TipoPago = 'suscripcion' | 'anual' | 'manual'

const PRECIOS = {
  diurno:   { mensual: 1000,  anual: 11000 },
  nocturno: { mensual: 1500,  anual: 13500 },
}

export function RegistroForm() {
  const [paso, setPaso]           = useState<1 | 2>(1)
  const [exito, setExito]         = useState(false)
  const [showPass, setShowPass]   = useState(false)
  const [isPending, startTransition] = useTransition()

  // Paso 1
  const [nombre,       setNombre]       = useState('')
  const [email,        setEmail]        = useState('')
  const [telefono,     setTelefono]     = useState('')
  const [password,     setPassword]     = useState('')
  const [nombreAlumno, setNombreAlumno] = useState('')
  const [grado,        setGrado]        = useState('')
  const [turno,        setTurno]        = useState<string>('')

  // Paso 2
  const [tipoPago, setTipoPago] = useState<TipoPago | null>(null)

  const turnoKey = turno === 'Noche' ? 'nocturno' : 'diurno'
  const precios  = PRECIOS[turnoKey]
  const cursos   = turno === 'Noche' ? CURSOS_NOCHE : CURSOS_MANANA

  // Cuando cambia el turno, resetear el curso si ya no aplica
  const handleTurnoChange = (nuevoTurno: string) => {
    setTurno(nuevoTurno)
    setGrado('')
  }

  const OPCIONES_PAGO = [
    {
      id: 'suscripcion' as TipoPago,
      titulo: 'Suscripción mensual',
      badge: '⭐ Recomendado',
      precio: `${formatMonto(precios.mensual)}/mes`,
      desc: 'Se descuenta solo cada mes. No tenés que hacer nada.',
      colorActivo: 'border-slate-900 bg-slate-900 text-white',
      proximamente: true,
    },
    {
      id: 'anual' as TipoPago,
      titulo: 'Pagar 1 año',
      badge: null,
      precio: `${formatMonto(precios.anual)}/año`,
      desc: 'Un solo pago por todo el ciclo lectivo.',
      colorActivo: 'border-emerald-600 bg-emerald-600 text-white',
      proximamente: true,
    },
    {
      id: 'manual' as TipoPago,
      titulo: 'Pago mensual',
      badge: null,
      precio: `${formatMonto(precios.mensual)}/mes`,
      desc: 'Ingresás al portal cada mes y pagás cuando quieras.',
      colorActivo: 'border-slate-500 bg-slate-500 text-white',
      proximamente: false,
    },
  ]

  const paso1Valido =
    nombre.trim() &&
    email.trim() &&
    telefono.trim() &&
    password.length >= 6 &&
    nombreAlumno.trim() &&
    grado &&
    turno

  const handleSubmit = () => {
    if (!tipoPago) return

    const formData = new FormData()
    formData.set('nombre',        nombre)
    formData.set('email',         email)
    formData.set('telefono',      telefono)
    formData.set('password',      password)
    formData.set('nombre_alumno', nombreAlumno)
    formData.set('grado',         grado)
    formData.set('turno',         turno)
    formData.set('tipo_pago',     tipoPago)

    startTransition(async () => {
      const result = await registrarPagadorPublico(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      // Si MP devolvió una URL, redirigir directo al checkout
      if (result.mpUrl) {
        window.location.href = result.mpUrl
        return
      }
      setExito(true)
    })
  }

  // ── Pantalla de éxito ───────────────────────────────────────
  if (exito) {
    return (
      <div className="text-center py-8 space-y-4">
        <div className="flex justify-center">
          <CheckCircle2 className="h-16 w-16 text-emerald-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">¡Registro completado!</h2>
        <p className="text-slate-600">
          Tu cuenta fue creada para <strong>{nombreAlumno}</strong>.
        </p>
        <p className="text-sm text-slate-500">
          Ingresá con tu email y contraseña para ver el estado de tus cuotas.
        </p>
        <a
          href="/cuenta"
          className="inline-flex items-center justify-center h-9 px-6 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-700 transition-colors"
        >
          Ir a mi cuenta →
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Indicador de pasos */}
      <div className="flex items-center gap-2">
        <div className={cn(
          'h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
          paso === 1 ? 'bg-slate-900 text-white' : 'bg-emerald-500 text-white'
        )}>
          {paso === 1 ? '1' : '✓'}
        </div>
        <div className={cn('h-1 flex-1 rounded', paso === 2 ? 'bg-emerald-500' : 'bg-slate-200')} />
        <div className={cn(
          'h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
          paso === 2 ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-400'
        )}>
          2
        </div>
      </div>

      {/* ── PASO 1 ── */}
      {paso === 1 && (
        <div className="space-y-4">

          {/* Datos personales */}
          <div>
            <h2 className="font-semibold text-slate-900">Tus datos</h2>
            <p className="text-sm text-slate-500">Solo te pedimos lo necesario.</p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="nombre">Nombre completo</Label>
              <Input
                id="nombre"
                placeholder="Ana García"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                autoComplete="name"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ana@mail.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="telefono">WhatsApp</Label>
                <Input
                  id="telefono"
                  type="tel"
                  placeholder="11 1234-5678"
                  value={telefono}
                  onChange={e => setTelefono(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">Creá tu contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-400">
                La vas a usar para ingresar a tu cuenta en el portal.
              </p>
            </div>
          </div>

          {/* Datos del/la estudiante */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div>
              <h2 className="font-semibold text-slate-900">Datos del/la estudiante</h2>
            </div>

            <div className="space-y-1">
              <Label htmlFor="alumno">Nombre</Label>
              <Input
                id="alumno"
                placeholder="Martín García"
                value={nombreAlumno}
                onChange={e => setNombreAlumno(e.target.value)}
              />
            </div>

            {/* Turno primero — define los cursos disponibles */}
            <div className="space-y-2">
              <Label>Turno</Label>
              <div className="grid grid-cols-2 gap-2">
                {TURNOS.map(t => (
                  <button
                    key={t.valor}
                    type="button"
                    onClick={() => handleTurnoChange(t.valor)}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-lg border-2 py-3 px-4 text-sm font-medium transition-all',
                      turno === t.valor
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    )}
                  >
                    <span className="text-xl">{t.emoji}</span>
                    <span>{t.valor}</span>
                  </button>
                ))}
              </div>
              {turno === 'Noche' && (
                <p className="text-xs text-slate-400">
                  El turno noche tiene 1°, 2° y 3° año.
                </p>
              )}
            </div>

            {/* Año — depende del turno */}
            <div className="space-y-1">
              <Label htmlFor="grado">Año / Curso</Label>
              <select
                id="grado"
                value={grado}
                onChange={e => setGrado(e.target.value)}
                disabled={!turno}
                className="flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">
                  {turno ? 'Seleccioná el año' : 'Primero elegí el turno'}
                </option>
                {cursos.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <Button
            className="w-full"
            onClick={() => setPaso(2)}
            disabled={!paso1Valido}
          >
            Continuar →
          </Button>
        </div>
      )}

      {/* ── PASO 2 ── */}
      {paso === 2 && (
        <div className="space-y-4">
          <div>
            <h2 className="font-semibold text-slate-900">¿Cómo querés pagar?</h2>
            <p className="text-sm text-slate-500">
              Turno {turno} · {nombreAlumno} · {grado}
            </p>
          </div>

          <div className="space-y-3">
            {OPCIONES_PAGO.map(op => (
              <button
                key={op.id}
                type="button"
                disabled={op.proximamente}
                onClick={() => !op.proximamente && setTipoPago(op.id)}
                className={cn(
                  'w-full text-left rounded-xl border-2 p-4 transition-all',
                  op.proximamente
                    ? 'opacity-55 cursor-not-allowed border-slate-200 bg-slate-50'
                    : tipoPago === op.id
                    ? op.colorActivo
                    : 'border-slate-200 hover:border-slate-300'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn(
                        'font-semibold text-sm',
                        tipoPago !== op.id && 'text-slate-900'
                      )}>
                        {op.titulo}
                      </span>
                      {op.badge && (
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-medium',
                          tipoPago === op.id
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 text-slate-600'
                        )}>
                          {op.badge}
                        </span>
                      )}
                      {op.proximamente && (
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full',
                          tipoPago === op.id
                            ? 'bg-white/20 text-white'
                            : 'bg-amber-100 text-amber-700'
                        )}>
                          🔜 Próximamente
                        </span>
                      )}
                    </div>
                    <p className={cn(
                      'text-xs mt-0.5',
                      tipoPago === op.id ? 'text-white/80' : 'text-slate-500'
                    )}>
                      {op.desc}
                    </p>
                  </div>
                  <div className={cn(
                    'text-right shrink-0 font-bold text-sm',
                    tipoPago !== op.id && 'text-slate-900'
                  )}>
                    {op.precio}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => setPaso(1)}
              className="flex-1"
              disabled={isPending}
            >
              ← Atrás
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={!tipoPago || isPending || !!OPCIONES_PAGO.find(o => o.id === tipoPago)?.proximamente}
            >
              {isPending
                ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Registrando...</>
                : 'Registrarme'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
