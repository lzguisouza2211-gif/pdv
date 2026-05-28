import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Quando building para Electron (npm run electron:build), usa caminhos relativos
// para que o index.html funcione via file:// dentro do Electron empacotado.
// Na versão web (Vercel), mantém base '/' para funcionar com as rewrites.
const isElectronBuild = process.env.ELECTRON === 'true'

export default defineConfig({
  base: isElectronBuild ? './' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
  },
  // No build Electron, as credenciais chegam via IPC (preload) — zeramos as VITE_ vars
  // para que não apareçam no bundle dist/ inspecionável.
  define: isElectronBuild ? {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(''),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(''),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(''),
  } : {},
})
