/**
 * Backend local: impressão ESC/POS + notificações WhatsApp (Z-API)
 *
 * Instalação:
 *   npm install
 *
 * Opcional (impressora via porta serial COM3, COM4...):
 *   npm install @node-escpos/core @node-escpos/serial serialport
 *
 * Configuração via .env:
 *   PRINTER_PATH  — porta serial (ex: COM3). Deixe vazio para usar nome Windows.
 *   PRINTER_NAME  — nome da impressora no Windows (Painel > Impressoras). Vazio = padrão.
 *   ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN — credenciais Z-API
 *
 * Rodando:
 *   npm run printer
 */

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { exec, execFile } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const app = express()
const PORT = process.env.PRINTER_PORT ?? 3000
const PRINTER_PATH = process.env.PRINTER_PATH ?? ''   // ex: COM3, /dev/usb/lp0
const PRINTER_NAME = process.env.PRINTER_NAME ?? ''   // nome no Windows
const PRINT_ALLOW_CONSOLE_FALLBACK = process.env.PRINT_ALLOW_CONSOLE_FALLBACK === 'true'
const PRINTER_FEED_LINES = Math.max(0, Number(process.env.PRINTER_FEED_LINES ?? 15))
const PRINTER_APPEND_FORM_FEED = (process.env.PRINTER_APPEND_FORM_FEED ?? 'true') === 'true'

const ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID
const ZAPI_TOKEN = process.env.ZAPI_TOKEN
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => res.json({ ok: true }))

// ─── Funções de impressão ────────────────────────────────────────────────────

async function printViaEscpos(text) {
  const { Printer } = require('@node-escpos/core')
  const { Serial } = require('@node-escpos/serial')
  const device = new Serial(PRINTER_PATH, { baudRate: 9600 })
  await new Promise((resolve, reject) => {
    device.open((err) => {
      if (err) return reject(err)
      const printer = new Printer(device)
      printer.align('lt').text(text).cut().close().then(resolve).catch(reject)
    })
  })
}

async function printViaWindows(text) {
  const normalized = text.replace(/\r?\n/g, '\r\n')
  const tearOffFeed = '\r\n'.repeat(PRINTER_FEED_LINES)
  const textToPrint = normalized + tearOffFeed + (PRINTER_APPEND_FORM_FEED ? '\f' : '')

  const tmp = join(tmpdir(), `receipt_${Date.now()}.txt`)
  writeFileSync(tmp, textToPrint, 'latin1')

  // Using execFile avoids cmd.exe quoting issues with printer names like "Generic / Text Only".
  const escapedPath = tmp.replace(/'/g, "''")
  const hasPrinterName = Boolean(PRINTER_NAME && PRINTER_NAME.trim())
  const escapedPrinterName = (PRINTER_NAME || '').replace(/'/g, "''")
  const command = hasPrinterName
    ? `$content = Get-Content -LiteralPath '${escapedPath}' -Raw -Encoding OEM; $content | Out-Printer -Name '${escapedPrinterName}'`
    : `$content = Get-Content -LiteralPath '${escapedPath}' -Raw -Encoding OEM; $content | Out-Printer`

  return new Promise((resolve, reject) => {
    execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', command],
      (err) => {
        try { unlinkSync(tmp) } catch {}
        err ? reject(err) : resolve()
      }
    )
  })
}

async function doPrint(text) {
  const failures = []

  // 1. Tentar ESC/POS via porta serial (se PRINTER_PATH configurado e lib instalada)
  if (PRINTER_PATH) {
    try {
      await printViaEscpos(text)
      console.log('[PRINT] Impresso via ESC/POS serial')
      return 'escpos'
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      failures.push(`ESC/POS: ${reason}`)
      console.warn('[PRINT] ESC/POS falhou, tentando Windows nativo:', reason)
    }
  }

  // 2. Impressão nativa Windows via PowerShell Out-Printer
  if (process.platform === 'win32') {
    try {
      await printViaWindows(text)
      const destino = PRINTER_NAME || 'impressora padrão'
      console.log(`[PRINT] Impresso via Windows (${destino})`)
      return 'windows'
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      failures.push(`Windows Out-Printer: ${reason}`)
      console.warn('[PRINT] Windows Out-Printer falhou:', reason)
    }
  }

  // 3. Fallback opcional: exibe no console (somente depuração)
  if (PRINT_ALLOW_CONSOLE_FALLBACK) {
    console.log('\n========== IMPRESSÃO (modo texto) ==========')
    console.log(text)
    console.log('============================================\n')
    return 'console'
  }

  const details = failures.length ? ` Detalhes: ${failures.join(' | ')}` : ''
  throw new Error(
    'Não foi possível enviar para a impressora.' +
      details +
      ' Configure PRINTER_NAME (Windows) ou PRINTER_PATH (serial).' 
  )
}

// ─── Rotas ───────────────────────────────────────────────────────────────────

app.post('/print', async (req, res) => {
  const { text } = req.body
  if (!text) return res.status(400).json({ error: 'text required' })
  try {
    const mode = await doPrint(text)
    res.json({ ok: true, mode })
  } catch (err) {
    console.error('[PRINT] Erro:', err)
    res.status(500).json({ error: String(err) })
  }
})

app.post('/send-whatsapp', async (req, res) => {
  const { phone, message } = req.body
  if (!phone || !message) return res.status(400).json({ error: 'phone and message required' })

  if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || ZAPI_INSTANCE_ID === 'SEU_INSTANCE_ID') {
    console.warn('[WPP] Z-API não configurado — notificação ignorada')
    return res.json({ ok: true, skipped: true })
  }

  try {
    const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': ZAPI_CLIENT_TOKEN },
      body: JSON.stringify({ phone, message }),
    })
    if (!response.ok) {
      const err = await response.text()
      console.error('[WPP] Z-API error:', err)
      return res.status(502).json({ error: err })
    }
    const data = await response.json()
    console.log(`[WPP] Mensagem enviada para ${phone}`)
    res.json({ ok: true, data })
  } catch (err) {
    console.error('[WPP] Erro ao enviar:', err)
    res.status(500).json({ error: String(err) })
  }
})

app.listen(PORT, () => {
  console.log(`\nBackend rodando em http://localhost:${PORT}`)
  console.log(`Impressora (serial): ${PRINTER_PATH || 'não configurada'}`)
  console.log(`Impressora (Windows): ${PRINTER_NAME || 'padrão do sistema'}`)
  console.log(`Avanco final (linhas): ${PRINTER_FEED_LINES}`)
  console.log(`Form feed final: ${PRINTER_APPEND_FORM_FEED ? 'ATIVO' : 'desativado'}`)
  console.log(`Fallback console: ${PRINT_ALLOW_CONSOLE_FALLBACK ? 'ATIVO' : 'desativado'}`)
  console.log(`WhatsApp (Z-API):    ${ZAPI_INSTANCE_ID && ZAPI_INSTANCE_ID !== 'SEU_INSTANCE_ID' ? 'configurado' : 'NÃO configurado'}\n`)
})
