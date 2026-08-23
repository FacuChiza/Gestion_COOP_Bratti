import { redirect } from 'next/navigation'

// Portal viejo del padre (con login). Reemplazado por /pagar en el modelo
// sin registro. Se conserva el código en el historial/respaldo por si se
// quisiera reactivar un portal con historial más adelante.
export default function DashboardPage() {
  redirect('/pagar')
}
