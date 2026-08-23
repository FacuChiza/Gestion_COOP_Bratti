import { redirect } from 'next/navigation'

// El portal con login por código quedó reemplazado por /pagar, que muestra
// el aporte y permite pagar sin cuenta ni código. Redirigimos links viejos.
export default function CuentaPage() {
  redirect('/pagar')
}
