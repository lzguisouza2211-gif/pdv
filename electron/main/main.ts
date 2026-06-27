import { app, BrowserWindow, shell, dialog } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import pkg from 'electron-updater'
const { autoUpdater } = pkg
import { ProcessManager } from './processManager.js'
import { registerIpcHandlers } from './ipc/handlers.js'
import { registerWhatsAppIpcHandlers } from './ipc/whatsapp.handlers.js'
import { registerPrinterIpcHandlers } from './ipc/printer.handlers.js'

import { getClient } from './services/whatsapp/BaileysClient.js'
import { getService } from './services/whatsapp/WhatsAppService.js'
import { OrderNotifier } from './services/OrderNotifier.js'

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
      sandbox: true,
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
    mainWindow.loadURL('http://localhost:5173/#/admin')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../../dist/index.html'), { hash: '/admin' })

    // Bloqueia DevTools em produção — F12, Ctrl+Shift+I, Ctrl+U
    mainWindow.webContents.on('before-input-event', (event, input) => {
      const ctrl = input.control || input.meta
      if (
        input.key === 'F12' ||
        (ctrl && input.shift && (input.key === 'I' || input.key === 'J')) ||
        (ctrl && input.key === 'U')
      ) {
        event.preventDefault()
      }
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

function setupAutoUpdater(): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-downloaded', () => {
    const choice = dialog.showMessageBoxSync({
      type: 'info',
      title: 'Atualização disponível',
      message: 'Uma nova versão do PDV foi baixada.',
      detail: 'Deseja reiniciar agora para aplicar a atualização?',
      buttons: ['Reiniciar agora', 'Mais tarde'],
      defaultId: 0,
    })
    if (choice === 0) autoUpdater.quitAndInstall()
  })

  autoUpdater.on('error', (err) => {
    console.error('[UPDATER] Erro ao verificar atualização:', err.message)
  })

  // Verifica após 5 s para não atrasar a abertura
  setTimeout(() => autoUpdater.checkForUpdates(), 5_000)
}

// Electron 33 (Chromium 130) doesn't trust GTS Root R4 cross-signed by GlobalSign Root CA,
// which Supabase's cert started using after April 2026. Allow the cert for supabase.co only.
app.on('certificate-error', (event, _webContents, url, _error, certificate, callback) => {
  const isSupabase = url.includes('supabase.co')
  const certForSupabase =
    certificate.subjectName?.includes('supabase.co') ||
    certificate.issuerName?.includes('Google Trust Services')
  if (isSupabase && certForSupabase) {
    event.preventDefault()
    callback(true)
  } else {
    callback(false)
  }
})

app.whenReady().then(async () => {
  // ── IPC geral (status dos backends) ────────────────────────────────────────
  registerIpcHandlers(processManager)

  // ── WhatsApp: inicializa singleton, registra IPC e sobe HTTP de compat. ────
  const wppClient  = getClient()
  const wppService = getService()

  registerWhatsAppIpcHandlers(wppService, wppClient)

  // Conecta ao WhatsApp em background — não bloqueia a abertura da janela
  wppClient.connect().catch((err) =>
    console.error('[ELECTRON] Erro ao conectar WhatsApp:', err)
  )

  // Inicia o listener Realtime para enviar mensagem de confirmação em novos pedidos
  new OrderNotifier().start()

  // ── Etapa 3: Printer — IPC direto, sem processo filho ──────────────────────
  registerPrinterIpcHandlers()

  createWindow()

  if (!isDev) setupAutoUpdater()

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
