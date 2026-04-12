export type Pagador = {
  id: string
  nombre: string
  dni: string | null
  telefono: string | null
  mail: string
  created_at: string
}

export type Alumno = {
  id: string
  nombre: string
  grado: string
  turno: string | null
  pagador_id: string | null
  activo: boolean
  created_at: string
  pagadores?: Pagador | null
}

export type Plan = {
  id: string
  nombre: string
  monto_total: number
  cantidad_meses: number
  precio_por_mes: number
}

export type Suscripcion = {
  id: string
  alumno_id: string
  plan_id: string
  fecha_inicio: string
  estado: string
  metodo_pago: string
  created_at: string
  planes?: Plan | null
}

export type CuotaEstado = 'pendiente' | 'pagada' | 'vencida'

export type Cuota = {
  id: string
  alumno_id: string
  suscripcion_id: string
  mes: number
  año: number
  monto: number
  estado: CuotaEstado
  created_at: string
}

export type Pago = {
  id: string
  pagador_id: string
  monto: number
  descuento: number
  fecha: string
  metodo: string
  referencia_externa: string | null
  registrado_por: string | null
  notas: string | null
  created_at: string
}

export type AlumnoConEstado = Alumno & {
  cuota_actual: Cuota | null
  cuotas_deuda: number
  suscripcion_activa: Suscripcion | null
}
