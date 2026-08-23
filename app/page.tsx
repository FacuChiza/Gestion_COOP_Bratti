import { redirect } from 'next/navigation'

// La raíz es la puerta del padre: va directo a realizar el aporte.
// El panel administrativo se accede por /admin.
export default function Home() {
  redirect('/pagar')
}
