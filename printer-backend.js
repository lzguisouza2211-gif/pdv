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
  const id     = Date.now()
  const tmpBin = join(tmpdir(), `receipt_${id}.bin`)
  const tmpPs  = join(tmpdir(), `receipt_${id}.ps1`)

  // ESC @ = reset printer; GS V 0 = full cut
  const init  = Buffer.from([0x1B, 0x40])
  const feeds = Buffer.from([0x0A, 0x0A, 0x0A])
  const cut   = Buffer.from([0x1D, 0x56, 0x00])
  writeFileSync(tmpBin, Buffer.concat([init, Buffer.from(text, 'latin1'), feeds, cut]))

  const pName = (PRINTER_NAME || 'Printer POS-80').replace(/"/g, '`"')
  // DLL cacheado em disco — compilado apenas na 1ª impressão, carregado rapidamente nas demais
  const dllPath = join(tmpdir(), 'PDVRawPrint.dll').replace(/\\/g, '\\\\')

  const psScript = `
$dll = "${dllPath}"
$src = @'
using System;
using System.Runtime.InteropServices;
public class RawPrint {
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
    public class DOCINFO {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
    [DllImport("winspool.Drv",EntryPoint="OpenPrinterA")] public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr d);
    [DllImport("winspool.Drv")] public static extern bool ClosePrinter(IntPtr h);
    [DllImport("winspool.Drv",EntryPoint="StartDocPrinterA")] public static extern int StartDocPrinter(IntPtr h, int lv, [In,MarshalAs(UnmanagedType.LPStruct)] DOCINFO di);
    [DllImport("winspool.Drv")] public static extern bool EndDocPrinter(IntPtr h);
    [DllImport("winspool.Drv")] public static extern bool StartPagePrinter(IntPtr h);
    [DllImport("winspool.Drv")] public static extern bool EndPagePrinter(IntPtr h);
    [DllImport("winspool.Drv")] public static extern bool WritePrinter(IntPtr h, IntPtr p, int c, out int w);
}
'@
if (Test-Path $dll) { Add-Type -Path $dll } else { Add-Type -TypeDefinition $src -OutputAssembly $dll }
$h = [IntPtr]::Zero
if (-not [RawPrint]::OpenPrinter("${pName}", [ref]$h, [IntPtr]::Zero)) {
    throw "OpenPrinter falhou - verifique o nome da impressora: '${pName}'"
}
$di = New-Object RawPrint+DOCINFO
$di.pDocName = "receipt"
$di.pDataType = "RAW"
$docId = [RawPrint]::StartDocPrinter($h, 1, $di)
if ($docId -le 0) { throw "StartDocPrinter falhou" }
[RawPrint]::StartPagePrinter($h) | Out-Null
$bytes = [System.IO.File]::ReadAllBytes("${tmpBin}")
$ptr = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
[System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $ptr, $bytes.Length)
$w = 0
[RawPrint]::WritePrinter($h, $ptr, $bytes.Length, [ref]$w) | Out-Null
[System.Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
[RawPrint]::EndPagePrinter($h) | Out-Null
[RawPrint]::EndDocPrinter($h) | Out-Null
[RawPrint]::ClosePrinter($h) | Out-Null
Write-Host "OK: $w bytes enviados"`

  writeFileSync(tmpPs, psScript, 'utf8')

  return new Promise((resolve, reject) => {
    exec(`powershell -ExecutionPolicy Bypass -File "${tmpPs}"`, { timeout: 30_000 }, (err, stdout, stderr) => {
      try { unlinkSync(tmpBin) } catch {}
      try { unlinkSync(tmpPs)  } catch {}
      if (err) {
        const msg = err.killed
          ? 'Impressora não respondeu em 30 segundos (timeout)'
          : stderr || err.message
        console.error('[PRINT] Erro PowerShell:', msg)
        reject(new Error(msg))
      } else {
        console.log('[PRINT]', stdout.trim())
        resolve()
      }
    })
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

app.listen(PORT, () => {
  console.log(`\nBackend rodando em http://localhost:${PORT}`)
  console.log(`Impressora (serial): ${PRINTER_PATH || 'não configurada'}`)
  console.log(`Impressora (Windows): ${PRINTER_NAME || 'padrão do sistema'}\n`)
})
