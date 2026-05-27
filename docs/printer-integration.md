# Integração Impressora — PDV

Documentação técnica do sistema de impressão térmica ESC/POS do PDV.

---

## Visão geral

```
┌─────────────────┐        ┌──────────────────────┐        ┌──────────────────┐
│  Frontend React │──────▶ │  printer-backend.js   │──────▶ │  Impressora POS  │
│  (Vite :5173)   │  HTTP  │  (Express :3000)      │  RAW   │  (térmica 80mm)  │
└─────────────────┘        └──────────────────────┘        └──────────────────┘
        │                             │
  printQueue.ts               doPrint() — 3 métodos
  receiptLayout.ts            em cascata (ver abaixo)
```

O frontend **monta o texto do cupom** e envia para o backend local que **envia para a impressora física**.

---

## Arquivos envolvidos

```
printer-backend.js                  # Servidor Express — porta 3000

src/
├── utils/
│   └── receiptLayout.ts            # Constrói o texto dos dois tipos de cupom
└── services/printer/
    ├── printQueue.ts               # printJob() — envia para o backend com retry
    ├── productionReceipt.ts        # Re-exporta buildProductionReceipt
    └── deliveryReceipt.ts          # Re-exporta buildDeliveryReceipt
```

---

## Rodando o backend

```bash
npm run printer
```

Saída esperada no terminal:

```
Backend rodando em http://localhost:3000
Impressora (serial): não configurada
Impressora (Windows): Printer POS-80
WhatsApp (Baileys):  http://localhost:3001
```

---

## Configuração (.env)

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PRINTER_PORT` | `3000` | Porta HTTP do servidor |
| `PRINTER_PATH` | _(vazio)_ | Porta serial: `COM3`, `COM4`, `/dev/usb/lp0` |
| `PRINTER_NAME` | _(vazio)_ | Nome da impressora no Windows (Painel de Controle → Impressoras) |
| `WPP_BACKEND_URL` | `http://localhost:3001` | URL do backend Baileys para proxy WhatsApp |

---

## Métodos de impressão (cascata)

O backend tenta os métodos abaixo **nesta ordem** e usa o primeiro que funcionar:

### 1. ESC/POS via porta serial

Ativa quando `PRINTER_PATH` está configurado **e** as libs opcionais estão instaladas.

```bash
npm install @node-escpos/core @node-escpos/serial serialport
```

Envia os comandos ESC/POS diretamente pela porta serial (mais confiável, sem dependência do Windows).

### 2. Windows nativo via PowerShell

Ativa automaticamente no Windows quando o método serial falha ou não está configurado.

Usa a Win32 API `WritePrinter` via PowerShell inline — **bypassa o GDI do Windows**, enviando dados RAW diretamente para o spooler. Funciona com qualquer impressora ESC/POS instalada no sistema.

O cupom é escrito em `/tmp` como `.bin`, enviado via PowerShell e depois apagado.

Sequência de comandos ESC/POS embutida:

| Bytes | Comando | Efeito |
|-------|---------|--------|
| `1B 40` | ESC @ | Reset da impressora |
| _(texto em latin1)_ | — | Conteúdo do cupom |
| `0A 0A 0A` | LF x3 | Avanço de papel |
| `1D 56 00` | GS V 0 | Corte completo |

### 3. Fallback — console

Se nenhum método funcionar, imprime o texto no terminal (útil para debug sem impressora física).

---

## Endpoints HTTP

### `GET /health`

```json
{ "ok": true }
```

### `POST /print`

Envia um cupom para impressão.

**Body:**
```json
{
  "text": "================================================\nPEDIDO: #42 ...\n"
}
```

**Resposta — sucesso:**
```json
{ "ok": true }
```

**Resposta — erro:**
```json
{ "error": "OpenPrinter falhou - verifique o nome da impressora: 'Printer POS-80'" }
```

### `POST /send-whatsapp`

Proxy para o backend Baileys. O frontend antigo usa esta rota — ela delega para `http://localhost:3001/whatsapp/send` internamente.

```json
{ "phone": "11987654321", "message": "Texto" }
```

Se o backend Baileys estiver fora, retorna `{ "ok": true, "skipped": true }` para não travar o PDV.

---

## Como o frontend monta e envia os cupons

### `src/utils/receiptLayout.ts`

Contém as funções que **montam o texto** do cupom. Largura padrão: **48 caracteres**.

#### `buildProductionReceipt(pedido)`

Cupom para a **cozinha/produção** — sem valores, focado nos itens e modificações.

```
================================================
PEDIDO: #42                        26/05/2025 - 19:30
TIPO: ENTREGA                      Mesa/Balcão: ---
================================================
ITENS:
------------------------------------------------
- 2x X-Burguer
  (SEM CEBOLA)
  (COM BACON EXTRA)
- 1x Batata Frita
================================================
```

#### `buildDeliveryReceipt(pedido)`

Cupom completo para o **motoboy/cliente** — com dados do cliente, endereço, valores e troco.

```
------------------------------------------------
              LUIZÃO LANCHES
         CNPJ: 12.805.279/0001-03
         Rua Exemplo, 123 - São Paulo/SP
------------------------------------------------
PEDIDO #42                        26/05/2025 - 19:30
------------------------------------------------
CLIENTE: João Silva
TELEFONE: (11) 98765-4321
ENTREGA: Rua das Flores, 100, Centro
------------------------------------------------
ITENS DO PEDIDO:
------------------------------------------------
2x X-Burguer                             R$ 39,80
  - Sem Cebola
  + Bacon Extra                           R$ 3,00
1x Batata Frita                          R$ 10,00
------------------------------------------------
QTD. ITENS: 3
------------------------------------------------
SUBTOTAL:                                R$ 52,80
TAXA ENTREGA:                             R$ 5,00
------------------------------------------------
TOTAL A PAGAR:                           R$ 57,80
------------------------------------------------
FORMA DE PAGAMENTO:
Dinheiro (Na Entrega)
Troco p/ R$ 100,00:                      R$ 42,20
------------------------------------------------
              Obrigado pela preferencia!
                    Volte sempre!
------------------------------------------------
```

---

### `src/services/printer/printQueue.ts`

Função principal que envia o cupom para o backend com **retry automático**.

```ts
import { printJob } from '@/services/printer/printQueue'

await printJob(pedido, 'producao')   // só cozinha
await printJob(pedido, 'motoboy')    // só entrega
await printJob(pedido, 'ambos')      // os dois (500ms de intervalo entre eles)
```

**Comportamento de retry:**

| Tentativa | Delay antes de tentar |
|-----------|-----------------------|
| 1ª | imediato |
| 2ª | 200ms |
| 3ª | 400ms |

Timeout por tentativa: **5 segundos**. Após 3 falhas, lança exceção.

---

## Configuração da impressora no Windows

1. Conecte a impressora USB/serial
2. Abra **Painel de Controle → Dispositivos e Impressoras**
3. Anote o nome exato da impressora (ex: `Printer POS-80`, `EPSON TM-T20`)
4. Coloque esse nome em `PRINTER_NAME` no `.env`

Para verificar os nomes disponíveis via PowerShell:
```powershell
Get-Printer | Select-Object Name
```

---

## Adicionando dados da loja no cupom

Edite o objeto `STORE` em `src/utils/receiptLayout.ts`:

```ts
const STORE = {
  nome: 'LUIZÃO LANCHES',
  cnpj: '12.805.279/0001-03',
  endereco: 'Rua Exemplo, 123 - São Paulo/SP',
}
```

---

## Diagnóstico de problemas

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| `OpenPrinter falhou` | Nome errado no `PRINTER_NAME` | Verifique com `Get-Printer` no PowerShell |
| Cupom sai com caracteres estranhos | Encoding incorreto | A impressora espera latin1; o backend já usa isso |
| Imprime no console em vez da impressora | Nenhum método funcionou | Configure `PRINTER_NAME` ou `PRINTER_PATH` |
| Timeout no frontend | Backend não está rodando | Execute `npm run printer` |
| Porta serial negada (Linux) | Sem permissão no `/dev/usb/lp0` | `sudo usermod -aG lp $USER` e reconecte |

---

## Teste rápido via curl

```bash
# Health check
curl http://localhost:3000/health

# Enviar cupom de teste
curl -X POST http://localhost:3000/print \
  -H "Content-Type: application/json" \
  -d '{"text":"================================================\n    TESTE DE IMPRESSAO\n================================================\n\n\n"}'
```
