'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  ADMIN_COOKIE,
  generarAdminToken,
  verificarCredencialesAdmin,
} from '@/lib/admin-session'

const MAX_AGE_DIAS = 7

export async function loginAdminAction(formData: FormData) {
  const user     = (formData.get('user')     as string ?? '').trim()
  const password = (formData.get('password') as string ?? '')

  if (!user || !password) {
    return { error: 'Completá usuario y contraseña.' }
  }

  if (!verificarCredencialesAdmin(user, password)) {
    // Mensaje genérico a propósito (no leakeamos si user existe).
    return { error: 'Usuario o contraseña incorrectos.' }
  }

  const token = await generarAdminToken()
  const store = await cookies()
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   60 * 60 * 24 * MAX_AGE_DIAS,
  })

  redirect('/admin')
}

export async function logoutAdminAction() {
  const store = await cookies()
  store.delete(ADMIN_COOKIE)
  redirect('/admin/login')
}
