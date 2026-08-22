import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Precios de los aportes. Viven en la tabla `configuracion` para que los
 * directivos puedan cambiarlos desde el panel sin tocar código.
 *
 * Regla de hermanos: si una familia (mismo pagador) tiene 2 o más alumnos
 * activos, cada uno paga `aporte_hermanos` en lugar de `aporte_mensual`.
 */

export type PreciosConfig = {
  mensual: number
  hermanos: number
  anual: number
}

const FALLBACK: PreciosConfig = { mensual: 10000, hermanos: 8000, anual: 100000 }

export async function getPreciosConfig(): Promise<PreciosConfig> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('configuracion')
    .select('clave, valor')
    .in('clave', ['aporte_mensual', 'aporte_hermanos', 'aporte_anual'])

  const map = new Map((data ?? []).map((r) => [r.clave, Number(r.valor)]))
  const num = (k: string, fb: number) => {
    const v = map.get(k)
    return v != null && !isNaN(v) && v > 0 ? v : fb
  }
  return {
    mensual:  num('aporte_mensual',  FALLBACK.mensual),
    hermanos: num('aporte_hermanos', FALLBACK.hermanos),
    anual:    num('aporte_anual',    FALLBACK.anual),
  }
}

/** Cantidad de alumnos activos que comparten pagador (para descuento hermanos). */
export async function cantidadFamiliaActiva(pagadorId: string | null): Promise<number> {
  if (!pagadorId) return 1
  const admin = createAdminClient()
  const { count } = await admin
    .from('alumnos')
    .select('*', { count: 'exact', head: true })
    .eq('pagador_id', pagadorId)
    .eq('activo', true)
  return Math.max(count ?? 1, 1)
}

/** Monto mensual que le corresponde a un alumno según el tamaño de su familia. */
export function montoMensual(cfg: PreciosConfig, cantidadFamilia: number): number {
  return cantidadFamilia >= 2 ? cfg.hermanos : cfg.mensual
}
