import { createClient } from '@supabase/supabase-js'

// No Electron, as credenciais chegam via IPC (preload) — nunca ficam no bundle do renderer.
// Na web (Vercel), usa as variáveis VITE_ normalmente.
declare global {
  interface Window {
    __APP_CONFIG__?: { url: string; key: string }
  }
}

const electronConfig = typeof window !== 'undefined' ? window.__APP_CONFIG__ : undefined
const supabaseUrl = electronConfig?.url ?? (import.meta.env.VITE_SUPABASE_URL as string)
const supabaseAnonKey = electronConfig?.key ?? ((import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string)

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    detectSessionInUrl: false,
    persistSession: true,
    autoRefreshToken: true,
  },
})
