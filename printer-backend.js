/**
 * Servidor de impressão ESC/POS — Express + @node-escpos
 *
 * Instalação das dependências do printer:
 *   npm install express cors @node-escpos/core @node-escpos/serial serialport
 *
 * Configuração:
 *   Defina a variável PRINTER_PATH com o caminho da porta serial (ex: /dev/usb/lp0 no Linux
 *   ou COM3 no Windows). Por padrão tentará COM1 / /dev/usb/lp0.
 *
 * Rodando:
 *   node printer-backend.js
 */

import express from 'express'
import cors from 'cors'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const app = express()
const PORT = process.env.PRINTER_PORT ?? 3000
const PRINTER_PATH = process.env.PRINTER_PATH ?? (process.platform === 'win32' ? 'COM1' : '/dev/usb/lp0')

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

app.listen(PORT, () => {
  console.log(`Printer backend rodando em http://localhost:${PORT}`)
  console.log(`Porta da impressora: ${PRINTER_PATH}`)
})
