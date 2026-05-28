/**
 * Lê o .env e gera electron/main/credentials.ts com as credenciais do Supabase.
 * Esse arquivo é gitignored e nunca vai para o repositório.
 * As credenciais ficam APENAS no processo main (ASAR), fora do bundle do renderer.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const envPath = path.join(root, '.env')

if (!fs.existsSync(envPath)) {
  console.error('[generate-credentials] .env não encontrado em', envPath)
  process.exit(1)
}

const raw = fs.readFileSync(envPath, 'utf-8')
const env = Object.fromEntries(
  raw.split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => {
      const idx = l.indexOf('=')
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
    })
)

const url = env.VITE_SUPABASE_URL ?? ''
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? ''

if (!url || !key) {
  console.error('[generate-credentials] VITE_SUPABASE_URL ou VITE_SUPABASE_PUBLISHABLE_KEY não encontrados no .env')
  process.exit(1)
}

const outPath = path.join(root, 'electron/main/credentials.ts')
fs.writeFileSync(outPath, `// AUTO-GERADO — não commite este arquivo (está no .gitignore)
// Credenciais do Supabase: ficam APENAS no processo main, fora do bundle do renderer.
export const SUPABASE_URL = ${JSON.stringify(url)}
export const SUPABASE_KEY = ${JSON.stringify(key)}
`)

console.log('[generate-credentials] electron/main/credentials.ts gerado com sucesso.')
