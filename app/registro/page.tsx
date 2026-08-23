import { redirect } from 'next/navigation'

// El registro con 8 campos quedó obsoleto: en el modelo nuevo la escuela
// precarga el padrón y el padre paga por DNI del alumno, sin registrarse.
// Redirigimos cualquier link viejo al flujo nuevo.
export default function RegistroPage() {
  redirect('/pagar')
}
