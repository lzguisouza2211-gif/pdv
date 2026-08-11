import { exec } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createRequire } from 'module'
import { readConfig } from './ConfigStore.js'
import { logger } from '../../logger.js'

const require = createRequire(import.meta.url)

async function printViaEscpos(text: string, printerPath: string): Promise<void> {
  const start = Date.now()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { Printer } = require('@node-escpos/core') as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { Serial } = require('@node-escpos/serial') as any
  const device = new Serial(printerPath, { baudRate: 9600 })
  await new Promise<void>((resolve, reject) => {
    device.open((err: Error | null) => {
      if (err) return reject(err)
      const printer = new Printer(device)
      printer.align('lt').text(text).cut().close().then(resolve).catch(reject)
    })
  })
  logger.info('PRINT', `ESC/POS serial concluído em ${Date.now() - start}ms`, { printerPath })
}

async function printViaWindows(text: string, printerName: string): Promise<void> {
  const id = Date.now()
  const tmpBin = join(tmpdir(), `receipt_${id}.bin`)
  const tmpPs  = join(tmpdir(), `receipt_${id}.ps1`)

  const init  = Buffer.from([0x1b, 0x40])
  const feeds = Buffer.from([0x0a, 0x0a, 0x0a])
  const cut   = Buffer.from([0x1d, 0x56, 0x00])
  writeFileSync(tmpBin, Buffer.concat([init, Buffer.from(text, 'latin1'), feeds, cut]))

  const pName = (printerName || 'Printer POS-80').replace(/"/g, '`"')
  // DLL cacheado em disco — compilado apenas na 1ª impressão, carregado rapidamente nas demais
  const dllPath = join(tmpdir(), 'PDVRawPrint.dll').replace(/\\/g, '\\\\')

  const psScript = `
$sw = [System.Diagnostics.Stopwatch]::StartNew()
function Mark($label) { Write-Host "TIMING $label : $($sw.ElapsedMilliseconds)ms" }
Mark "script-start"
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
Mark "addtype-done"
$h = [IntPtr]::Zero
if (-not [RawPrint]::OpenPrinter("${pName}", [ref]$h, [IntPtr]::Zero)) {
    throw "OpenPrinter falhou - verifique o nome da impressora: '${pName}'"
}
Mark "openprinter-done"
$di = New-Object RawPrint+DOCINFO
$di.pDocName = "receipt"
$di.pDataType = "RAW"
$docId = [RawPrint]::StartDocPrinter($h, 1, $di)
if ($docId -le 0) { throw "StartDocPrinter falhou" }
Mark "startdocprinter-done"
[RawPrint]::StartPagePrinter($h) | Out-Null
Mark "startpageprinter-done"
$bytes = [System.IO.File]::ReadAllBytes("${tmpBin}")
$ptr = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
[System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $ptr, $bytes.Length)
$w = 0
[RawPrint]::WritePrinter($h, $ptr, $bytes.Length, [ref]$w) | Out-Null
Mark "writeprinter-done"
[System.Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
[RawPrint]::EndPagePrinter($h) | Out-Null
Mark "endpageprinter-done"
[RawPrint]::EndDocPrinter($h) | Out-Null
Mark "enddocprinter-done"
[RawPrint]::ClosePrinter($h) | Out-Null
Mark "closeprinter-done"
Write-Host "OK: $w bytes enviados"`

  writeFileSync(tmpPs, psScript, 'utf8')

  const start = Date.now()
  logger.info('PRINT', 'Enviando via PowerShell/spooler Windows', { printerName: pName })

  return new Promise<void>((resolve, reject) => {
    exec(`powershell -ExecutionPolicy Bypass -File "${tmpPs}"`, { timeout: 30_000 }, (err, stdout, stderr) => {
      try { unlinkSync(tmpBin) } catch {}
      try { unlinkSync(tmpPs)  } catch {}
      const elapsed = Date.now() - start
      if (err) {
        const msg = err.killed
          ? 'Impressora não respondeu em 30 segundos (timeout)'
          : stderr || err.message
        logger.error('PRINT', `Erro PowerShell após ${elapsed}ms`, msg)
        reject(new Error(msg))
      } else {
        logger.info('PRINT', `PowerShell concluído em ${elapsed}ms`, stdout.trim())
        resolve()
      }
    })
  })
}

export async function doPrint(text: string): Promise<void> {
  const start = Date.now()
  const { printerName, printerPath } = readConfig()
  logger.info('PRINT', 'Início da impressão', { chars: text.length, printerName, printerPath })

  if (printerPath) {
    try {
      await printViaEscpos(text, printerPath)
      logger.info('PRINT', `Impresso via ESC/POS serial — total ${Date.now() - start}ms`)
      return
    } catch (err) {
      logger.warn('PRINT', 'ESC/POS falhou, tentando Windows nativo', (err as Error).message)
    }
  }

  if (process.platform === 'win32') {
    await printViaWindows(text, printerName)
    logger.info('PRINT', `Impresso via Windows (${printerName || 'impressora padrão'}) — total ${Date.now() - start}ms`)
    return
  }

  logger.info('PRINT', `Modo texto (sem impressora) — total ${Date.now() - start}ms`)
  console.log('\n========== IMPRESSÃO (modo texto) ==========')
  console.log(text)
  console.log('============================================\n')
}
