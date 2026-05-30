import { app } from 'electron'
import { appendFileSync, mkdirSync } from 'fs'
import { join } from 'path'

function getLogPath(): string {
  try {
    const dir = join(app.getPath('userData'), 'logs')
    mkdirSync(dir, { recursive: true })
    return join(dir, 'pdv.log')
  } catch {
    return join(app.getPath('temp'), 'pdv.log')
  }
}

function write(level: string, tag: string, msg: string, extra?: unknown): void {
  const timestamp = new Date().toISOString()
  let line = `[${timestamp}] [${level}] ${tag} ${msg}`
  if (extra !== undefined) {
    if (extra instanceof Error) {
      line += ` — ${extra.message}\n  ${extra.stack ?? ''}`
    } else {
      try { line += ` — ${JSON.stringify(extra)}` } catch { line += ` — ${String(extra)}` }
    }
  }
  line += '\n'

  // Sempre no console do processo main
  if (level === 'ERROR') console.error(line.trimEnd())
  else console.log(line.trimEnd())

  // E em arquivo — visível mesmo em produção no Windows
  try { appendFileSync(getLogPath(), line) } catch { /* sem acesso a disco */ }
}

export const logger = {
  info:  (tag: string, msg: string, extra?: unknown) => write('INFO',  tag, msg, extra),
  warn:  (tag: string, msg: string, extra?: unknown) => write('WARN',  tag, msg, extra),
  error: (tag: string, msg: string, extra?: unknown) => write('ERROR', tag, msg, extra),
  /** Caminho do arquivo de log — mostre na UI de diagnóstico se necessário. */
  getPath: getLogPath,
}
