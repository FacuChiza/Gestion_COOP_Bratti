import { AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type AlumnoDeuda = {
  id: string
  nombre: string
  grado: string
  turno: string | null
  cuotas_deuda: number
  pagadores?: { nombre: string; mail: string; telefono: string | null } | null
}

type Props = {
  alumnos: AlumnoDeuda[]
  minMeses?: number
}

export function AlertsSection({ alumnos, minMeses = 3 }: Props) {
  if (alumnos.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-8 text-emerald-600">
          <span className="text-2xl">✓</span>
          <span>Ningún alumno con {minMeses} o más meses de deuda.</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <p className="text-sm font-medium">
          {alumnos.length} alumno{alumnos.length !== 1 ? 's' : ''} con {minMeses} o más meses de deuda acumulada
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {alumnos.map((alumno) => (
          <Card key={alumno.id} className="border-red-200">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base">{alumno.nombre}</CardTitle>
                <Badge variant="danger">{alumno.cuotas_deuda} meses</Badge>
              </div>
              <p className="text-xs text-slate-500">
                {alumno.grado}{alumno.turno ? ` · ${alumno.turno}` : ''}
              </p>
            </CardHeader>
            {alumno.pagadores && (
              <CardContent>
                <p className="text-sm text-slate-700 font-medium">{alumno.pagadores.nombre}</p>
                <p className="text-xs text-slate-500">{alumno.pagadores.mail}</p>
                {alumno.pagadores.telefono && (
                  <p className="text-xs text-slate-500">{alumno.pagadores.telefono}</p>
                )}
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
