import { createClient } from '@supabase/supabase-js'

// Cliente admin con service role key — solo usar en Server Actions/API Routes
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
