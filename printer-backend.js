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
import { exec } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const app = express()
const PORT = process.env.PRINTER_PORT ?? 3000
const PRINTER_PATH = process.env.PRINTER_PATH ?? ''   // ex: COM3, /dev/usb/lp0
const PRINTER_NAME = process.env.PRINTER_NAME ?? ''   // nome no Windows

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
  const tmp = join(tmpdir(), `receipt_${Date.now()}.txt`)
  writeFileSync(tmp, text, 'latin1')
  const printerArg = PRINTER_NAME ? `-Name "${PRINTER_NAME}"` : ''
  return new Promise((resolve, reject) => {
    exec(
      `powershell -Command "Get-Content -Encoding OEM '${tmp}' | Out-Printer ${printerArg}"`,
      (err) => {
        try { unlinkSync(tmp) } catch {}
        err ? reject(err) : resolve()
      }
    )
  })
}

async function doPrint(text) {
  // 1. Tentar ESC/POS via porta serial (se PRINTER_PATH configurado e lib instalada)
  if (PRINTER_PATH) {
    try {
      await printViaEscpos(text)
      console.log('[PRINT] Impresso via ESC/POS serial')
      return
    } catch (err) {
      console.warn('[PRINT] ESC/POS falhou, tentando Windows nativo:', err.message)
    }
  }

  // 2. Impressão nativa Windows via PowerShell Out-Printer
  if (process.platform === 'win32') {
    try {
      await printViaWindows(text)
      const destino = PRINTER_NAME || 'impressora padrão'
      console.log(`[PRINT] Impresso via Windows (${destino})`)
      return
    } catch (err) {
      console.warn('[PRINT] Windows Out-Printer falhou:', err.message)
    }
  }

  // 3. Fallback: exibe no console (para depuração)
  console.log('\n========== IMPRESSÃO (modo texto) ==========')
  console.log(text)
  console.log('============================================\n')
}

// ─── Rotas ───────────────────────────────────────────────────────────────────

app.post('/print', async (req, res) => {
  const { text } = req.body
  if (!text) return res.status(400).json({ error: 'text required' })
  try {
    await doPrint(text)
    res.json({ ok: true })
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
  console.log(`WhatsApp (Z-API):    ${ZAPI_INSTANCE_ID && ZAPI_INSTANCE_ID !== 'SEU_INSTANCE_ID' ? 'configurado' : 'NÃO configurado'}\n`)
})
