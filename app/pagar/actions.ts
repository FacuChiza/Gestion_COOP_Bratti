'use server'

import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Busca un pagador por DNI exacto. Devuelve solo su ID (para construir
 * la URL del link personal /aporte/[id]) — no expone datos sensibles.
 *
 * Si hay 2 pagadores con el mismo DNI (caso patológico), tomamos el primero
 * y dejamos que el flujo de /aporte/[id] muestre los datos.
 */
export async function buscarPagadorPorDNI(dniRaw: string): Promise<{ id?: string; error?: string }> {
  const dni = (dniRaw ?? '').trim().replace(/\D/g, '') // dejamos solo dígitos
  if (dni.length < 6) {
    return { error: 'Ingresá un DNI válido (mínimo 6 dígitos)' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pagadores')
    .select('id')
    .eq('dni', dni)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[buscarPagadorPorDNI]', error)
    return { error: 'Hubo un problema al buscar. Probá de nuevo.' }
  }
  if (!data) {
    return { error: 'No encontramos a nadie con ese DNI. Si tu hijo/a se anotó hace poco, probá más tarde o acercate a la cooperadora.' }
  }
  return { id: data.id }
}
