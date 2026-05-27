import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

export interface AppConfig {
  printerName: string
  printerPath: string
}

const DEFAULTS: AppConfig = {
  printerName: '',
  printerPath: '',
}

function getConfigPath(): string {
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  return join(dir, 'pdv-config.json')
}

export function readConfig(): AppConfig {
  const path = getConfigPath()
  if (!existsSync(path)) return { ...DEFAULTS }
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(path, 'utf8')) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeConfig(patch: Partial<AppConfig>): AppConfig {
  const next = { ...readConfig(), ...patch }
  writeFileSync(getConfigPath(), JSON.stringify(next, null, 2), 'utf8')
  return next
}
