'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Mail, KeyRound, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { loginAction, magicLinkAction } from '@/app/cuenta/actions'
import { Logo } from '@/components/Logo'

type Modo = 'magic' | 'password'

export function LoginForm() {
  const [modo, setModo] = useState<Modo>('magic')
  const [magicEnviado, setMagicEnviado] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

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
          <Logo size={56} subtitulo="Cooperadora" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ingresar al portal</CardTitle>
            <CardDescription>
              Te enviamos un enlace mágico al mail. Sin contraseñas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Pantalla de "te llegó el mail" */}
            {magicEnviado ? (
              <div className="text-center space-y-3 py-2">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
                <div>
                  <p className="font-semibold text-slate-900">Revisá tu mail</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Te enviamos un enlace a <strong>{magicEnviado}</strong>.<br />
                    Click ahí y entrás directo a tu portal.
                  </p>
                </div>
                <p className="text-xs text-slate-400">
                  Si no aparece, revisá la carpeta de Spam o promociones.
                </p>
                <button
                  onClick={() => setMagicEnviado(null)}
                  className="text-xs text-slate-500 underline hover:text-slate-700"
                >
                  Usar otro email
                </button>
              </div>
            ) : (
              <>
                {/* Toggle Magic Link / Contraseña */}
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg mb-4">
                  <button
                    type="button"
                    onClick={() => setModo('magic')}
                    className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      modo === 'magic'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Enlace por mail
                  </button>
                  <button
                    type="button"
                    onClick={() => setModo('password')}
                    className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      modo === 'password'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Contraseña
                  </button>
                </div>

                {modo === 'magic' ? (
                  <form onSubmit={handleMagic} className="space-y-4">
                    <div className="space-y-1">
                      <Label htmlFor="email-magic">Email</Label>
                      <Input
                        id="email-magic"
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="tu@email.com"
                      />
                      <p className="text-xs text-slate-400">
                        Te llega un mail con un enlace para entrar. No necesitás recordar contraseña.
                      </p>
                    </div>
                    <Button type="submit" className="w-full" disabled={isPending}>
                      {isPending ? 'Enviando...' : 'Enviarme el enlace'}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handlePassword} className="space-y-4">
                    <div className="space-y-1">
                      <Label htmlFor="email-pwd">Email</Label>
                      <Input
                        id="email-pwd"
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="tu@email.com"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="password">Contraseña</Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        required
                        autoComplete="current-password"
                        placeholder="••••••••"
                      />
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
          <a href="/registro" className="underline hover:text-slate-600">Registrate acá</a>
        </p>
      </div>
    </div>
  )
}
