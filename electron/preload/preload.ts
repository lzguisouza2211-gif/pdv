/**
 * Preload — ponte segura entre o processo renderer (React) e o main (Electron).
 *
 * Regras de segurança aplicadas:
 *   - contextIsolation: true  → renderer NÃO acessa Node.js diretamente
 *   - nodeIntegration: false  → sem require/fs/etc no renderer
 *   - Apenas métodos explícitos são expostos via contextBridge
 *
 * API disponível no renderer como: window.electronAPI
 */

import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'

type BackendStatus = 'starting' | 'running' | 'stopped' | 'error'
type StatusMap = Record<string, BackendStatus>
type StatusListener = (status: StatusMap) => void

contextBridge.exposeInMainWorld('electronAPI', {
  /** Informações de versão do runtime */
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },

  /** Indica que o app está rodando dentro do Electron */
  isElectron: true,

  /** Gerenciamento dos processos backend */
  backends: {
    /** Retorna o status atual de todos os backends */
    getStatus: (): Promise<StatusMap> =>
      ipcRenderer.invoke('backend:status'),

    /** Reinicia um backend pelo nome ('printer' | 'whatsapp') */
    restart: (name: string): Promise<StatusMap> =>
      ipcRenderer.invoke('backend:restart', name),

    /**
     * Escuta mudanças de status dos backends.
     * Retorna uma função para cancelar a assinatura (cleanup).
     */
    onStatusChange: (cb: StatusListener): (() => void) => {
      const handler = (_: IpcRendererEvent, s: StatusMap) => cb(s)
      ipcRenderer.on('backend:status-changed', handler)
      return () => ipcRenderer.removeListener('backend:status-changed', handler)
    },
  },
})
