'use client'

import { useState, useTransition, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Mail, KeyRound, CheckCircle2, ArrowLeft, Sparkles, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { loginAction, magicLinkAction } from '@/app/cuenta/actions'
import { Logo } from '@/components/Logo'

type Modo = 'magic' | 'password'

export function LoginForm() {
  const searchParams = useSearchParams()
  const [modo, setModo] = useState<Modo>('magic')
  const [magicEnviado, setMagicEnviado] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Si vinimos del callback con un error, lo mostramos
  useEffect(() => {
    const auth = searchParams.get('auth')
    if (auth === 'expirado') {
      toast.error('El enlace expiró o ya se usó. Pedí uno nuevo.')
    } else if (auth === 'invalido') {
      toast.error('El enlace de acceso no es válido.')
    }
  }, [searchParams])

  const handleMagic = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string

    startTransition(async () => {
      const r = await magicLinkAction(formData)
      if (r?.error) {
        toast.error(r.error)
        return
      }
      setMagicEnviado(email)
    })
  }

  const handlePassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await loginAction(formData)
      if (r?.error) toast.error(r.error)
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
            {/* ── Pantalla "te llegó el mail" ──────────────────────── */}
            {magicEnviado ? (
              <div className="text-center space-y-4 py-2">
                <div className="flex justify-center">
                  <div className="h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Revisá tu mail</h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Te enviamos un enlace a:
                  </p>
                  <p className="text-sm font-semibold text-slate-900 mt-1 break-all">
                    {magicEnviado}
                  </p>
                </div>

                <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800 text-left">
                  <p className="font-semibold flex items-center gap-1.5 mb-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    ¿No te llega?
                  </p>
                  <ul className="space-y-0.5 list-disc list-inside text-amber-700">
                    <li>Revisá la carpeta de Spam o Promociones</li>
                    <li>Puede demorar hasta 1 minuto</li>
                  </ul>
                </div>

                <button
                  onClick={() => setMagicEnviado(null)}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Usar otro email
                </button>
              </div>
            ) : (
              <>
                {/* ── Header del card ────────────────────────────── */}
                <div className="mb-5">
                  <h1 className="text-xl font-bold text-slate-900">Ingresar al portal</h1>
                  <p className="text-sm text-slate-500 mt-1">
                    {modo === 'magic'
                      ? 'Te mandamos un enlace al mail. Sin contraseñas.'
                      : 'Usá tu email y contraseña para entrar.'}
                  </p>
                </div>

                {/* ── Toggle Magic / Contraseña ──────────────────── */}
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg mb-5">
                  <button
                    type="button"
                    onClick={() => setModo('magic')}
                    className={`flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-all ${
                      modo === 'magic'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Enlace por mail
                  </button>
                  <button
                    type="button"
                    onClick={() => setModo('password')}
                    className={`flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-all ${
                      modo === 'password'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Contraseña
                  </button>
                </div>

                {/* ── Form Magic Link ───────────────────────────── */}
                {modo === 'magic' && (
                  <form onSubmit={handleMagic} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email-magic">Email registrado</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <Input
                          id="email-magic"
                          name="email"
                          type="email"
                          required
                          autoComplete="email"
                          placeholder="tu@email.com"
                          className="pl-9"
                        />
                      </div>
                      <p className="text-xs text-slate-400">
                        Tiene que ser el email con el que te diste de alta.
                      </p>
                    </div>
                    <Button type="submit" className="w-full gap-2" disabled={isPending}>
                      {isPending ? (
                        'Enviando...'
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Enviarme el enlace
                        </>
                      )}
                    </Button>
                  </form>
                )}

                {/* ── Form Contraseña ───────────────────────────── */}
                {modo === 'password' && (
                  <form onSubmit={handlePassword} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email-pwd">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <Input
                          id="email-pwd"
                          name="email"
                          type="email"
                          required
                          autoComplete="email"
                          placeholder="tu@email.com"
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="password">Contraseña</Label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <Input
                          id="password"
                          name="password"
                          type="password"
                          required
                          autoComplete="current-password"
                          placeholder="••••••••"
                          className="pl-9"
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={isPending}>
                      {isPending ? 'Ingresando...' : 'Ingresar'}
                    </Button>
                  </form>
                )}
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
