'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { User, KeyRound, LogIn, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { loginAdminAction } from '@/app/admin/login/actions'

export function AdminLoginForm() {
  const [verPassword, setVerPassword] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const r = await loginAdminAction(fd)
      if (r?.error) toast.error(r.error)
      // si fue OK, la action hace redirect()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="user">Usuario</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            id="user"
            name="user"
            type="text"
            required
            autoComplete="username"
            placeholder="admin"
            className="pl-9"
            defaultValue="admin"
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
            type={verPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="pl-9 pr-9"
          />
          <button
            type="button"
            onClick={() => setVerPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <Button type="submit" className="w-full gap-2" disabled={isPending}>
        {isPending ? (
          'Ingresando...'
        ) : (
          <>
            <LogIn className="h-4 w-4" />
            Ingresar al panel
          </>
        )}
      </Button>

      <p className="text-xs text-slate-400 text-center pt-1">
        Tu sesión queda activa por 7 días en este dispositivo.
      </p>
    </form>
  )
}
