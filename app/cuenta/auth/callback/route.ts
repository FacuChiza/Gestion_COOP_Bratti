/**
 * Callback del Magic Link de Supabase.
 *
 * Cuando el padre clickea el enlace que recibió por mail, Supabase lo manda
 * acá con un `code` en la query. Lo intercambiamos por una sesión y lo
 * mandamos al dashboard.
 *
 * Si algo falla (link expirado, ya usado, etc.), volvemos a /cuenta con un
 * mensaje. Necesitamos esta URL dada de alta como Redirect URL en el
 * dashboard de Supabase: ${NEXT_PUBLIC_APP_URL}/cuenta/auth/callback
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/cuenta?auth=invalido`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth/callback]', error)
    return NextResponse.redirect(`${origin}/cuenta?auth=expirado`)
  }

  return NextResponse.redirect(`${origin}/cuenta/dashboard`)
}
