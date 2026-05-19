import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_COOKIE, esAdminTokenValido } from '@/lib/admin-session'

// ─── Protección /admin con cookie firmada (HMAC) ──────────────────────────────
//
// Reemplaza el HTTP Basic Auth (popup feo del navegador) por una sesión propia
// administrada con cookie httpOnly. La cookie se setea en /admin/login después
// de validar usuario/contraseña, y la firma HMAC se valida en cada request.

async function checkAdminSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(ADMIN_COOKIE)?.value
  return esAdminTokenValido(token)
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/')
}

// ─── Middleware principal ─────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1) /admin/login es público (es el form de acceso)
  //    pero si ya hay sesión, redirigir al panel
  if (pathname === '/admin/login') {
    const yaLogueado = await checkAdminSession(request)
    if (yaLogueado) {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
    return NextResponse.next()
  }

  // 2) /admin/* y /api/admin/* requieren sesión admin
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const ok = await checkAdminSession(request)
    if (!ok) {
      if (isApiPath(pathname)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      // Página → redirigir al login conservando la ruta original
      const loginUrl = new URL('/admin/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  // 3) Sesión Supabase para /cuenta
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Proteger /cuenta/dashboard — redirigir al login si no hay sesión
  if (!user && pathname.startsWith('/cuenta/dashboard')) {
    return NextResponse.redirect(new URL('/cuenta', request.url))
  }

  // Si ya está logueado y va al login, redirigir al dashboard
  if (user && pathname === '/cuenta') {
    return NextResponse.redirect(new URL('/cuenta/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/cuenta',
    '/cuenta/dashboard',
    '/cuenta/dashboard/:path*',
  ],
}
