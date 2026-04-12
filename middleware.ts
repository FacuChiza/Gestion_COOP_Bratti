import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ─── Protección /admin con HTTP Basic Auth ────────────────────────────────────

function checkAdminAuth(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get('authorization')

  if (authHeader?.startsWith('Basic ')) {
    const base64 = authHeader.slice(6)
    const decoded = Buffer.from(base64, 'base64').toString('utf-8')
    const [user, ...rest] = decoded.split(':')
    const password = rest.join(':') // por si la contraseña tiene ':'

    const validUser = process.env.ADMIN_USER ?? 'admin'
    const validPassword = process.env.ADMIN_PASSWORD ?? ''

    if (user === validUser && password === validPassword) {
      return null // autenticado, continuar
    }
  }

  // No autenticado → pedir credenciales
  return new NextResponse('Acceso no autorizado', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Panel Administrativo", charset="UTF-8"',
    },
  })
}

// ─── Middleware principal ─────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Proteger /admin
  if (pathname.startsWith('/admin')) {
    const adminDenied = checkAdminAuth(request)
    if (adminDenied) return adminDenied
  }

  // 2. Gestionar sesión Supabase para /cuenta
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
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
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
    '/cuenta',
    '/cuenta/dashboard',
    '/cuenta/dashboard/:path*',
  ],
}
