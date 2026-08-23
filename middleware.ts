import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_COOKIE, esAdminTokenValido } from '@/lib/admin-session'

// ─── Protección /admin con cookie firmada (HMAC) ──────────────────────────────
// El flujo del padre (/pagar) es público y sin login, así que el middleware
// solo protege el panel administrativo.

async function checkAdminSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(ADMIN_COOKIE)?.value
  return esAdminTokenValido(token)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // /admin/login es público; si ya hay sesión, ir directo al panel
  if (pathname === '/admin/login') {
    if (await checkAdminSession(request)) {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
    return NextResponse.next()
  }

  // /admin/* y /api/admin/* requieren sesión admin
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    if (!(await checkAdminSession(request))) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
