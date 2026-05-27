import { ipcMain, BrowserWindow } from 'electron'
import type { ProcessManager } from '../processManager.js'

/**
 * Etapa 1: handlers básicos de status dos backends.
 * Etapas 2-3 adicionarão handlers de WhatsApp e Impressão.
 */
export function registerIpcHandlers(pm: ProcessManager): void {
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
