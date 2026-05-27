/**
 * ProcessManager — Etapa 1
 *
 * Responsável por iniciar e gerenciar os processos backend como filhos do
 * processo Electron. Em dev usa `node` e `tsx` do sistema. Em produção
 * usa o próprio binário do Electron com ELECTRON_RUN_AS_NODE=1.
 *
 * NÃO modifica nenhum backend existente — apenas os spawna.
 */

import { spawn, ChildProcess } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { app } from 'electron'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export type BackendStatus = 'starting' | 'running' | 'stopped' | 'error'
export type StatusMap = Record<string, BackendStatus>

interface BackendConfig {
  name: string
  command: string
  args: string[]
  cwd: string
  env?: Partial<NodeJS.ProcessEnv>
  /** Texto no stdout que indica que o backend está pronto */
  readySignal?: string
  /** Timeout (ms) para considerar o backend como rodando mesmo sem readySignal */
  readyTimeout?: number
}

export class ProcessManager {
  private processes = new Map<string, ChildProcess>()
  private statuses = new Map<string, BackendStatus>()
  private listeners: Array<(s: StatusMap) => void> = []

  // ─── Caminhos ──────────────────────────────────────────────────────────────

  private get projectRoot(): string {
    if (app.isPackaged) {
      // No app empacotado, backends ficam em app.asar.unpacked/
      return join(process.resourcesPath!, 'app.asar.unpacked')
    }
    // Dev: electron-dist/main -> electron-dist -> raiz do projeto
    return join(__dirname, '..', '..')
  }

  // ─── Configuração dos backends ─────────────────────────────────────────────

  private getConfigs(): BackendConfig[] {
    const root = this.projectRoot
    const isPackaged = app.isPackaged

    // Em dev, procura o tsx instalado localmente
    return [
      {
        name: 'printer',
        // Dev: node printer-backend.js | Prod: electron --node printer-backend.js
        command: isPackaged ? process.execPath : 'node',
        args: [join(root, 'printer-backend.js')],
        cwd: root,
        env: isPackaged ? { ELECTRON_RUN_AS_NODE: '1' } : {},
        readySignal: 'Backend rodando',
        readyTimeout: 5_000,
      },
      // WhatsApp (Baileys) foi migrado para dentro do processo Electron na Etapa 2.
      // Não é mais spawned como processo filho. Ver main.ts e services/whatsapp/.
    ]
  }

  // ─── API pública ───────────────────────────────────────────────────────────

  async startAll(): Promise<void> {
    for (const cfg of this.getConfigs()) {
      try {
        await this.start(cfg)
      } catch (err) {
        console.error(`[PM] Falha ao iniciar "${cfg.name}":`, (err as Error).message)
        this.setStatus(cfg.name, 'error')
      }
    }
  }

  stopAll(): void {
    for (const [name, proc] of this.processes) {
      if (!proc.killed) {
        console.log(`[PM] Encerrando "${name}" (PID: ${proc.pid})`)
        proc.kill('SIGTERM')
      }
    }
    this.processes.clear()
  }

  async restart(name: string): Promise<void> {
    const proc = this.processes.get(name)
    if (proc && !proc.killed) {
      proc.kill('SIGTERM')
      await new Promise<void>((r) => setTimeout(r, 1_000))
    }
    const cfg = this.getConfigs().find((c) => c.name === name)
    if (cfg) await this.start(cfg)
  }

  getStatuses(): StatusMap {
    return Object.fromEntries(this.statuses)
  }

  onStatusChange(cb: (s: StatusMap) => void): void {
    this.listeners.push(cb)
  }

  // ─── Spawn de um backend ───────────────────────────────────────────────────

  private start(cfg: BackendConfig): Promise<void> {
    this.setStatus(cfg.name, 'starting')

    return new Promise<void>((resolve) => {
      // Herda as variáveis de ambiente do processo pai, removendo as do
      // Electron que causariam conflito em processos Node.js filhos
      const baseEnv: NodeJS.ProcessEnv = { ...process.env }
      delete baseEnv.ELECTRON_RUN_AS_NODE
      delete baseEnv.ELECTRON_NO_ASAR
      delete baseEnv.ELECTRON_ENABLE_LOGGING

      const env: NodeJS.ProcessEnv = { ...baseEnv, ...(cfg.env ?? {}) }

      console.log(`[PM] Iniciando "${cfg.name}": ${cfg.command} ${cfg.args.join(' ')}`)

      const child = spawn(cfg.command, cfg.args, {
        cwd: cfg.cwd,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      })

      this.processes.set(cfg.name, child)

      let resolved = false
      const done = () => {
        if (!resolved) {
          resolved = true
          resolve()
        }
      }

      // Resolve pelo timeout independente do readySignal
      const readyTimer = setTimeout(() => {
        if (!resolved) {
          this.setStatus(cfg.name, 'running')
          done()
        }
      }, cfg.readyTimeout ?? 5_000)

      child.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString().trim()
        if (!text) return
        console.log(`[${cfg.name.toUpperCase()}]`, text)

        if (!resolved && cfg.readySignal && text.includes(cfg.readySignal)) {
          clearTimeout(readyTimer)
          this.setStatus(cfg.name, 'running')
          done()
        }
      })

      child.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString().trim()
        // Muitas libs escrevem logs informativos no stderr (ex: pino)
        // Só loga mas não altera o status
        if (text) console.error(`[${cfg.name.toUpperCase()} ERR]`, text)
      })

      child.on('error', (err) => {
        clearTimeout(readyTimer)
        console.error(`[PM] Erro ao iniciar "${cfg.name}":`, err.message)
        this.setStatus(cfg.name, 'error')
        done()
      })

      child.on('close', (code) => {
        clearTimeout(readyTimer)
        console.log(`[PM] Backend "${cfg.name}" encerrou (code: ${code ?? 'null'})`)
        this.setStatus(cfg.name, 'stopped')
        this.processes.delete(cfg.name)
      })
    })
  }

  // ─── Notificação de mudança de status ─────────────────────────────────────

  private setStatus(name: string, status: BackendStatus): void {
    this.statuses.set(name, status)
    const all = this.getStatuses()
    for (const cb of this.listeners) cb(all)
  }
}
