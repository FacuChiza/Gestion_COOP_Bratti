import { Suspense } from 'react'
import { LoginForm } from '@/components/cuenta/LoginForm'

// LoginForm usa useSearchParams() (para leer ?auth=expirado), por eso
// necesita estar envuelto en Suspense durante el static render.
export default function CuentaPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
