import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ─── Singleton ──────────────────────────────────────────────────────────────
// Cliente com service_role: bypassa RLS. Só o backend deve ter essa chave —
// nunca exponha em código de front-end.
let _client: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client

  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar configuradas no .env do backend.'
    )
  }

  _client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return _client
}
