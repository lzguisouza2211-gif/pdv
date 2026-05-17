/**
 * Backend local: impressão ESC/POS + notificações WhatsApp (Z-API)
 *
 * Instalação:
 *   npm install express cors dotenv @node-escpos/core @node-escpos/serial serialport
 *
 * Configuração via .env:
 *   PRINTER_PATH  — porta serial da impressora (ex: COM3 no Windows, /dev/usb/lp0 no Linux)
 *   ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN — credenciais Z-API (app.z-api.io)
 *
 * Rodando:
 *   node printer-backend.js
 */

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const app = express()
const PORT = process.env.PRINTER_PORT ?? 3000
const PRINTER_PATH = process.env.PRINTER_PATH ?? (process.platform === 'win32' ? 'COM1' : '/dev/usb/lp0')

const ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID
const ZAPI_TOKEN = process.env.ZAPI_TOKEN
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => res.json({ ok: true }))

app.post('/print', async (req, res) => {
  const { text } = req.body
  if (!text) return res.status(400).json({ error: 'text required' })

  try {
    // Tenta usar @node-escpos/core + @node-escpos/serial se disponível
    let printed = false
    try {
      const { Printer } = require('@node-escpos/core')
      const { Serial } = require('@node-escpos/serial')
      const device = new Serial(PRINTER_PATH, { baudRate: 9600 })
      await new Promise((resolve, reject) => {
        device.open((err) => {
          if (err) return reject(err)
          const printer = new Printer(device)
          printer
            .align('lt')
            .text(text)
            .cut()
            .close()
            .then(resolve)
            .catch(reject)
        })
      })
      printed = true
    } catch (_escposErr) {
      // fallback: tenta escpos clássico
      try {
        const escpos = require('escpos')
        const Serial = require('escpos-serialport')
        const device = new Serial(PRINTER_PATH)
        const printer = new escpos.Printer(device)
        await new Promise((resolve, reject) => {
          device.open(() => {
            printer
              .align('lt')
              .text(text)
              .cut()
              .close()
            resolve(null)
          })
          setTimeout(() => reject(new Error('timeout')), 5000)
        })
        printed = true
      } catch (_fallbackErr) {
        // sem impressora disponível — loga no console para depuração
        console.log('\n========== IMPRESSÃO (modo texto) ==========')
        console.log(text)
        console.log('============================================\n')
        printed = true
      }
    }

    if (printed) res.json({ ok: true })
  } catch (err) {
    console.error('Erro na impressão:', err)
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
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': ZAPI_CLIENT_TOKEN,
      },
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
  console.log(`Backend rodando em http://localhost:${PORT}`)
  console.log(`Impressora: ${PRINTER_PATH}`)
  console.log(`WhatsApp (Z-API): ${ZAPI_INSTANCE_ID ? 'configurado' : 'NÃO configurado'}`)
})
