import { app, BrowserWindow, shell } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import { ProcessManager } from './processManager.js'
import { registerIpcHandlers } from './ipc/handlers.js'
import { registerWhatsAppIpcHandlers } from './ipc/whatsapp.handlers.js'

import { getClient } from './services/whatsapp/BaileysClient.js'
import { getService } from './services/whatsapp/WhatsAppService.js'
import { WhatsAppHttpServer } from './services/whatsapp/WhatsAppHttpServer.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const isDev = !app.isPackaged

export const processManager = new ProcessManager()
let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: 'PDV Luizão Lanches',
    icon: join(__dirname, '../../public/icon.png'),
    show: false,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    // HashRouter usa /#/admin — o Vite serve qualquer caminho normalmente
    mainWindow.loadURL('http://localhost:5173/#/admin')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    // Produção: file:// + HashRouter funciona sem servidor (sem rewrites)
    mainWindow.loadFile(join(__dirname, '../../dist/index.html'), {
      hash: '/admin',
    })
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  // ── IPC geral (status dos backends) ────────────────────────────────────────
  registerIpcHandlers(processManager)

  // ── WhatsApp: inicializa singleton, registra IPC e sobe HTTP de compat. ────
  const wppClient  = getClient()
  const wppService = getService()

  registerWhatsAppIpcHandlers(wppService, wppClient)

  const wppHttp = new WhatsAppHttpServer(wppService)
  wppHttp.start(3001)

  // Conecta ao WhatsApp em background — não bloqueia a abertura da janela
  wppClient.connect().catch((err) =>
    console.error('[ELECTRON] Erro ao conectar WhatsApp:', err)
  )

  // ── Apenas o printer backend é spawned (whatsapp rodando dentro do Electron) ─
  await processManager.startAll()

  // Aguarda o printer backend subir antes de abrir a janela
  await new Promise<void>((r) => setTimeout(r, 1_500))

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  processManager.stopAll()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  processManager.stopAll()
})
