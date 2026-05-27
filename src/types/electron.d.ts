/**
 * Tipos globais do bridge Electron → React.
 *
 * `window.electronAPI` só existe quando o app roda dentro do Electron.
 * Na versão web (Vercel) a propriedade é undefined.
 *
 * Use assim para detectar o ambiente:
 *   if (window.electronAPI?.isElectron) { ... }
 */

export {}

type BackendStatus = 'starting' | 'running' | 'stopped' | 'error'
type StatusMap = Record<string, BackendStatus>

declare global {
  interface Window {
    electronAPI?: {
      versions: {
        node: string
        chrome: string
        electron: string
      }

      /** true quando rodando dentro do Electron, undefined na web */
      isElectron: true

      backends: {
        /** Retorna o status atual de todos os backends */
        getStatus: () => Promise<StatusMap>

        /** Reinicia um backend pelo nome ('printer' | 'whatsapp') */
        restart: (name: string) => Promise<StatusMap>

        /**
         * Assina mudanças de status dos backends.
         * Retorna cleanup function para usar em useEffect.
         *
         * @example
         * useEffect(() => {
         *   return window.electronAPI?.backends.onStatusChange(setStatuses)
         * }, [])
         */
        onStatusChange: (cb: (status: StatusMap) => void) => () => void
      }
    }
  }
}
