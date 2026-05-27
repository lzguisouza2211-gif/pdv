import { ipcMain, BrowserWindow } from 'electron'
import { doPrint } from '../services/printer/PrinterService.js'
import { readConfig, writeConfig } from '../services/printer/ConfigStore.js'
import type { AppConfig } from '../services/printer/ConfigStore.js'

export function registerPrinterIpcHandlers(): void {
  ipcMain.handle('printer:print', async (_event, text: string) => {
    await doPrint(text)
    return { ok: true }
  })

  ipcMain.handle('printer:get-config', () => {
    return readConfig()
  })

  ipcMain.handle('printer:set-config', (_event, patch: Partial<AppConfig>) => {
    return writeConfig(patch)
  })

  ipcMain.handle('printer:list-printers', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return []
    const printers = await win.webContents.getPrintersAsync()
    return printers.map((p) => ({ name: p.name, isDefault: p.isDefault }))
  })
}
