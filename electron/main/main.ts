import { app, BrowserWindow, shell } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { ProcessManager } from './processManager.js'
import { registerIpcHandlers } from './ipc/handlers.js'

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
    show: false,
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
  })

  // Abre links externos no browser do sistema, não dentro do Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    // Dev: carrega o Vite dev server (que continua rodando normalmente)
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    // Prod: carrega o build do Vite (dist/index.html)
    mainWindow.loadFile(join(__dirname, '../../dist/index.html'))
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
  registerIpcHandlers(processManager)

  // Inicia os backends (printer porta 3000, whatsapp porta 3001)
  // Não bloqueia a abertura da janela se um backend falhar
  processManager.startAll().catch((err) => {
    console.error('[ELECTRON] Falha ao iniciar backends:', err)
  })

  // Aguarda um momento para os backends iniciarem antes de abrir a janela
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
