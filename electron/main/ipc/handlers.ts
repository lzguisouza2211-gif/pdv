import { ipcMain, BrowserWindow } from 'electron'
import type { ProcessManager } from '../processManager.js'
import { SUPABASE_URL, SUPABASE_KEY } from '../credentials.js'

export function registerIpcHandlers(pm: ProcessManager): void {
  // Credenciais do Supabase — entregues ao renderer via preload (fora do bundle Vite)
  ipcMain.on('config:get-supabase', (event) => {
    event.returnValue = { url: SUPABASE_URL, key: SUPABASE_KEY }
  })

  // Retorna o status atual de todos os backends
  ipcMain.handle('backend:status', () => pm.getStatuses())

  // Reinicia um backend específico por nome ('printer' | 'whatsapp')
  ipcMain.handle('backend:restart', async (_event, name: string) => {
    await pm.restart(name)
    return pm.getStatuses()
  })

  // Propaga mudanças de status para todas as janelas abertas
  pm.onStatusChange((statuses) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('backend:status-changed', statuses)
      }
    }
  })
}
