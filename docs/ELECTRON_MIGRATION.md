# Migração para Electron — PDV Luizão Lanches

Documentação completa das 4 etapas de migração do PDV para um app desktop Electron.
A versão web (Vercel) foi preservada integralmente em paralelo.

---

## Visão geral

**Antes:** sistema web-only. Impressão e WhatsApp dependiam de dois processos Node.js separados rodando em background na máquina do operador (`printer-backend.js` na porta 3000, `backend/` Baileys na porta 3001). O operador precisava iniciar esses processos manualmente.

**Depois:** app desktop empacotável (`.exe`, `.AppImage`, `.deb`) onde tudo roda dentro de um único processo Electron. Zero processos externos para o operador gerenciar.

---

## Arquitetura final

```
Electron (processo main)
├── BaileysClient      — conexão WhatsApp via @whiskeysockets/baileys
├── WhatsAppService    — envio de mensagens com rate-limit
├── WhatsAppHttpServer — Express na porta 3001 (compatibilidade legada)
├── PrinterService     — impressão ESC/POS serial + PowerShell Windows
├── ConfigStore        — config persistida em userData/pdv-config.json
└── IPC handlers       — ponte segura com o renderer (React)

Electron (preload — CJS)
└── window.electronAPI — API tipada exposta via contextBridge

React (renderer)
├── whatsapp.service.ts — usa IPC no Electron, HTTP na web
├── printQueue.ts       — usa IPC no Electron, HTTP na web
├── /admin/WhatsApp     — página de conexão QR Code
└── /admin/Impressora   — página de configuração de impressora
```

---

## Etapa 1 — Shell Electron

**Objetivo:** empacotar o React existente dentro do Electron sem quebrar nada.

### Arquivos criados

| Arquivo | Função |
|---|---|
| `electron/main/main.ts` | Ponto de entrada do processo main |
| `electron/main/processManager.ts` | Spawna processos filhos (backends) |
| `electron/main/ipc/handlers.ts` | IPC de status dos backends |
| `electron/preload/preload.ts` | Bridge contextBridge → `window.electronAPI` |
| `tsconfig.electron.json` | Compila `electron/main/` como ESM/NodeNext |
| `tsconfig.preload.json` | Compila `electron/preload/` como **CommonJS** |
| `scripts/postbuild-electron.mjs` | Gera `electron-dist/preload/package.json` com `type:commonjs` |
| `vite.config.ts` | `base: './'` quando `ELECTRON=true` |
| `src/app/App.tsx` | Router condicional: `HashRouter` no Electron, `BrowserRouter` na web |

### Problema ESM vs CJS (preload)

O `package.json` raiz tem `"type": "module"`, então o Node.js trata todo `.js` como ESM. O Electron carrega o preload com `require()` interno (CJS) — conflito.

**Solução em duas partes:**
1. `tsconfig.preload.json` compila o preload com `"module": "CommonJS"` (sintaxe CJS no `.js` gerado)
2. `scripts/postbuild-electron.mjs` grava `electron-dist/preload/package.json` com `{"type":"commonjs"}` — esse arquivo fica mais próximo do `preload.js` e sobrescreve o comportamento do raiz

### Problema BrowserRouter vs HashRouter

Em produção o app abre via `file://`. O `BrowserRouter` depende de um servidor para reescrever rotas — sem servidor, qualquer rota diferente de `/` resulta em tela em branco.

**Solução:** `HashRouter` usa `#/admin` no fragmento da URL, que funciona com `file://` sem servidor. A detecção é feita por `window.electronAPI?.isElectron`.

### Scripts npm

```bash
npm run electron:compile        # compila main + preload (sem iniciar)
npm run electron:dev            # dev: Vite + TSC watch + Electron (hot reload)
npm run electron:build          # build de produção (React + Electron)
npm run electron:pack           # gera instalador Linux (AppImage + deb)
npm run electron:pack:win       # gera instalador Windows (NSIS + portable)
```

### electron-builder (package.json)

- **Windows:** NSIS installer + portable `.exe`, ícone `public/icon.ico`
- **Linux:** AppImage + deb, ícone `public/icon.png`
- **asarUnpack:** `printer-backend.js`, `node_modules/@node-escpos/**`, `node_modules/serialport/**`

---

## Etapa 2 — WhatsApp dentro do Electron

**Objetivo:** migrar o `backend/` (Baileys em processo separado) para dentro do processo main do Electron.

### Arquivos criados

| Arquivo | Função |
|---|---|
| `electron/main/services/whatsapp/BaileysClient.ts` | Singleton de conexão Baileys |
| `electron/main/services/whatsapp/WhatsAppService.ts` | Envio com rate-limit (2 s + jitter) |
| `electron/main/services/whatsapp/WhatsAppHttpServer.ts` | Express porta 3001 (compatibilidade) |
| `electron/main/services/whatsapp/MessageTemplates.ts` | Templates de mensagem |
| `electron/main/services/whatsapp/phoneUtils.ts` | Normalização de telefone |
| `electron/main/ipc/whatsapp.handlers.ts` | IPC: status, send, QR, connect, disconnect |
| `src/hooks/useWhatsApp.ts` | Hook React que consome os eventos IPC |
| `src/pages/admin/WhatsApp.tsx` | Página de gerenciamento (QR Code, status, uptime) |
| `src/types/electron.d.ts` | Tipos globais de `window.electronAPI` |

### Sessão Baileys

- **Dev:** reutiliza `backend/auth_info_baileys/` (sem re-escanear QR a cada reinício)
- **Produção:** `app.getPath('userData')/auth_info_baileys/`

### QR Code

O QR bruto (string) é convertido para PNG base64 via `qrcode.toDataURL()` no main process e enviado ao renderer como `data:image/png;base64,...` — pronto para `<img src={qrDataUrl} />`.

### Compatibilidade legada

`WhatsAppHttpServer` sobe um Express na porta 3001 com as mesmas rotas do `backend/` antigo (`/whatsapp/status`, `/whatsapp/send`, `/whatsapp/notify-order`). Isso garante que qualquer código que ainda use HTTP continue funcionando sem alteração.

### Página WhatsApp (`/admin/whatsapp`)

- Mostra status da conexão (Conectado / Aguardando QR / Conectando / Desconectado)
- Exibe QR Code para escanear com o celular
- Botões Reconectar / Desconectar
- Mostra tempo de uptime da conexão
- Fora do Electron exibe mensagem "Disponível apenas no app desktop"

---

## Etapa 3 — Impressora dentro do Electron

**Objetivo:** migrar o `printer-backend.js` (processo filho) para dentro do main, e permitir que o cliente configure o nome da impressora pela própria interface.

### Arquivos criados

| Arquivo | Função |
|---|---|
| `electron/main/services/printer/ConfigStore.ts` | Lê/grava `userData/pdv-config.json` |
| `electron/main/services/printer/PrinterService.ts` | `doPrint()`: ESC/POS serial + PowerShell Windows |
| `electron/main/ipc/printer.handlers.ts` | IPC: print, get-config, set-config, list-printers |
| `src/pages/admin/Impressora.tsx` | Página de configuração (lista + campo manual + salvar) |

### Config persistida

```json
// ~/.config/PDV Luizão Lanches/pdv-config.json  (Linux)
// %APPDATA%\PDV Luizão Lanches\pdv-config.json   (Windows)
{
  "printerName": "Printer POS-80",
  "printerPath": ""
}
```

- `printerName` — nome da impressora no Windows (Painel de Controle → Impressoras)
- `printerPath` — porta serial (`COM3`, `/dev/usb/lp0`); se preenchida, usa ESC/POS direto

### Lógica de impressão (`doPrint`)

1. Se `printerPath` preenchido → tenta ESC/POS via `@node-escpos/serial`
2. Se Windows → PowerShell + `WritePrinter` Win32 com o `printerName` configurado
3. Fallback → imprime no console (modo debug / Linux sem impressora)

### IPC da impressora

| Canal | Direção | Descrição |
|---|---|---|
| `printer:print` | renderer → main | Imprime texto ESC/POS |
| `printer:get-config` | renderer → main | Lê config atual |
| `printer:set-config` | renderer → main | Salva config |
| `printer:list-printers` | renderer → main | Lista impressoras do sistema |

### Página Impressora (`/admin/impressora`)

- Lista todas as impressoras instaladas no sistema (clicáveis)
- Campo de texto para digitar o nome manualmente
- Botão salvar (persiste entre sessões)
- Dica com comando `wmic printer get name` para Windows
- Fora do Electron exibe mensagem "Disponível apenas no app desktop"

---

## Etapa 4 — Substituição do HTTP por IPC

**Objetivo:** eliminar dependência de HTTP nos serviços do frontend quando rodando no Electron.

### Arquivo alterado

**`src/services/whatsapp.service.ts`**

```
Antes:  fetch('http://localhost:3001/whatsapp/send', ...)
Depois: window.electronAPI.whatsapp.send({ phone, message })  ← Electron
        fetch('http://localhost:3001/whatsapp/send', ...)      ← Web (fallback)
```

**`src/services/printer/printQueue.ts`** (feito na etapa 3)

```
Antes:  fetch('http://localhost:3000/print', ...)
Depois: window.electronAPI.printer.print(text)   ← Electron
        fetch('http://localhost:3000/print', ...) ← Web (fallback)
```

### Padrão de fallback

Todos os serviços seguem o mesmo padrão:

```typescript
if (window.electronAPI?.isElectron) {
  await window.electronAPI.xxx.yyy(payload)  // IPC — sem rede
  return
}
// fallback HTTP para versão web
await fetch('http://localhost:300x/...', { ... })
```

---

## IPC completo — referência

### `window.electronAPI.backends`

| Método | Retorno | Descrição |
|---|---|---|
| `getStatus()` | `StatusMap` | Status de todos os processos |
| `restart(name)` | `StatusMap` | Reinicia um processo |
| `onStatusChange(cb)` | `() => void` | Evento de mudança de status |

### `window.electronAPI.whatsapp`

| Método | Retorno | Descrição |
|---|---|---|
| `getStatus()` | `WppStatus` | Estado atual da conexão |
| `send({ phone, message })` | `{ ok }` | Envia mensagem de texto |
| `notifyOrder(payload)` | `{ ok }` | Envia notificação de pedido |
| `disconnect()` | `{ ok }` | Desconecta sessão |
| `reconnect()` | `{ ok }` | Reconecta / gera novo QR |
| `onQr(cb)` | `() => void` | QR Code como data URL PNG |
| `onConnected(cb)` | `() => void` | Evento: conectado |
| `onDisconnected(cb)` | `() => void` | Evento: desconectado |
| `onLogout(cb)` | `() => void` | Evento: logout remoto |
| `onStatusChange(cb)` | `() => void` | Evento: qualquer mudança |

### `window.electronAPI.printer`

| Método | Retorno | Descrição |
|---|---|---|
| `print(text)` | `{ ok }` | Imprime texto ESC/POS |
| `getConfig()` | `PrinterConfig` | Lê configuração atual |
| `setConfig(patch)` | `PrinterConfig` | Salva configuração |
| `listPrinters()` | `PrinterInfo[]` | Lista impressoras do sistema |

---

## Ícone do aplicativo

| Arquivo | Uso |
|---|---|
| `public/icon.png` | Linux (512×512 RGBA) — janela, taskbar, AppImage/deb |
| `public/icon.ico` | Windows (16/32/48/64/128/256 px) — exe, atalho, taskbar |

Gerados a partir de `public/ChatGPT Image 7 de fev. de 2026, 11_28_27.png` via Pillow.

No **Linux em modo dev** o ícone da taskbar é sempre a engrenagem do Electron (comportamento normal sem `.desktop` registrado). No **app empacotado** o `electron-builder` cria o `.desktop` correto e o ícone aparece em tudo.

---

## Entrega ao cliente (Windows)

```bash
npm run electron:pack:win
```

Gera em `release/`:
- `PDV Luizão Lanches Setup 1.0.0.exe` — instalador com wizard (recomendado)
- `PDV Luizão Lanches 1.0.0 Portable.exe` — roda sem instalar

As variáveis de ambiente (Supabase, etc.) são embutidas pelo Vite no momento do build — o cliente não precisa configurar nada.

Após instalar, o cliente acessa **`/admin/impressora`** para selecionar a impressora correta da sua máquina e salvar.

---

## Estrutura de arquivos (Electron)

```
electron/
├── main/
│   ├── main.ts                          # ponto de entrada
│   ├── processManager.ts                # (sem processos filhos — mantido para StatusMap)
│   ├── ipc/
│   │   ├── handlers.ts                  # IPC: backends status
│   │   ├── whatsapp.handlers.ts         # IPC: whatsapp completo
│   │   └── printer.handlers.ts          # IPC: impressora
│   └── services/
│       ├── whatsapp/
│       │   ├── BaileysClient.ts         # singleton Baileys
│       │   ├── WhatsAppService.ts       # envio com rate-limit
│       │   ├── WhatsAppHttpServer.ts    # Express porta 3001 (compat.)
│       │   ├── MessageTemplates.ts
│       │   ├── phoneUtils.ts
│       │   └── types.ts
│       └── printer/
│           ├── PrinterService.ts        # doPrint: serial + Windows
│           └── ConfigStore.ts           # pdv-config.json
└── preload/
    └── preload.ts                       # contextBridge → window.electronAPI
```
