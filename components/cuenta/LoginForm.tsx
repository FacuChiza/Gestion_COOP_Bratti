'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Mail, ArrowLeft, Sparkles, AlertCircle, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { pedirCodigoAction, verificarCodigoAction } from '@/app/cuenta/actions'
import { Logo } from '@/components/Logo'

type Paso = 'pedir' | 'verificar'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [paso, setPaso]     = useState<Paso>('pedir')
  const [email, setEmail]   = useState('')
  const [codigo, setCodigo] = useState('')
  const [isPending, startTransition] = useTransition()
  const inputCodigoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const auth = searchParams.get('auth')
    if (auth === 'expirado') toast.error('El código expiró o ya se usó.')
    if (auth === 'invalido') toast.error('El código no es válido.')
  }, [searchParams])

  // Autofocus al input del código cuando pasamos al paso 2
  useEffect(() => {
    if (paso === 'verificar') {
      setTimeout(() => inputCodigoRef.current?.focus(), 100)
    }
  }, [paso])

  const handlePedir = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await pedirCodigoAction(fd)
      if (r?.error) {
        toast.error(r.error)
        return
      }
      if (r?.ok) {
        setEmail(r.email ?? (fd.get('email') as string))
        setPaso('verificar')
        setCodigo('')
      }
    })
  }

  const handleVerificar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData()
    fd.set('email', email)
    fd.set('token', codigo)
    startTransition(async () => {
      const r = await verificarCodigoAction(fd)
      if (r?.error) {
        toast.error(r.error)
        return
      }
      // Sesión creada, redirigir al dashboard
      router.push('/cuenta/dashboard')
      router.refresh()
    })
  }

  const handleVolver = () => {
    setPaso('pedir')
    setCodigo('')
  }

  const handleReenviar = () => {
    const fd = new FormData()
    fd.set('email', email)
    startTransition(async () => {
      const r = await pedirCodigoAction(fd)
      if (r?.error) toast.error(r.error)
      else toast.success('Te enviamos un código nuevo.')
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <Logo size={64} subtitulo="Cooperadora" />
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-5 sm:p-6">
            {/* ── PASO 1: pedir código ───────────────────────────── */}
            {paso === 'pedir' && (
              <>
                <div className="mb-5">
                  <h1 className="text-xl font-bold text-slate-900">Ingresar al portal</h1>
                  <p className="text-sm text-slate-500 mt-1">
                    Te enviamos un código de 6 dígitos al mail. Sin contraseñas.
                  </p>
                </div>

                <form onSubmit={handlePedir} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email registrado</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="tu@email.com"
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={isPending}>
                    {isPending ? 'Enviando...' : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Enviarme el código
                      </>
                    )}
                  </Button>
                </form>
              </>
            )}

            {/* ── PASO 2: ingresar código ────────────────────────── */}
            {paso === 'verificar' && (
              <>
                <div className="mb-5">
                  <button
                    type="button"
                    onClick={handleVolver}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 mb-2"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Usar otro email
                  </button>
                  <h1 className="text-xl font-bold text-slate-900">Ingresá el código</h1>
                  <p className="text-sm text-slate-500 mt-1">
                    Te enviamos un código de 6 dígitos a:
                  </p>
                  <p className="text-sm font-semibold text-slate-900 break-all">{email}</p>
                </div>

                <form onSubmit={handleVerificar} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="codigo">Código</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <Input
                        ref={inputCodigoRef}
                        id="codigo"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        required
                        maxLength={6}
                        placeholder="123456"
                        value={codigo}
                        onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="pl-9 text-center text-lg tracking-[0.4em] font-mono"
                      />
                    </div>
                    <p className="text-xs text-slate-400">
                      Revisá tu casilla. Puede tardar hasta 1 minuto (mirá también Spam).
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isPending || codigo.length !== 6}
                  >
                    {isPending ? 'Verificando...' : 'Ingresar'}
                  </Button>

                  <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2 flex items-start gap-2">
                    <AlertCircle className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-slate-600">
                      <p>¿No te llegó el código?</p>
                      <button
                        type="button"
                        onClick={handleReenviar}
                        disabled={isPending}
                        className="text-slate-900 underline hover:text-slate-700 mt-0.5"
                      >
                        Reenviar código
                      </button>
                    </div>
                  </div>
                </form>
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400 mt-4">
          ¿No tenés cuenta?{' '}
          <a href="/registro" className="text-slate-600 underline hover:text-slate-900">
            Registrate acá
          </a>
        </p>
      </div>
    </div>
  )
}
