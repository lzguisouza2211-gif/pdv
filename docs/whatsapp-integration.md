# Integração WhatsApp — PDV Baileys

Documentação técnica da integração WhatsApp do sistema PDV usando [Baileys](https://github.com/WhiskeySockets/Baileys), sem API oficial da Meta.

---

## Visão geral

```
┌─────────────────┐        ┌──────────────────────┐        ┌──────────────┐
│  Frontend React │──────▶ │  Backend Baileys      │──────▶ │  WhatsApp    │
│  (Vite :5173)   │  HTTP  │  (Express :3001)      │  WS    │  Web         │
└─────────────────┘        └──────────────────────┘        └──────────────┘
                                      │
                             auth_info_baileys/
                             (sessão local)
```

O **printer-backend** (porta 3000) continua funcionando normalmente e faz proxy das chamadas `/send-whatsapp` para o backend Baileys.

---

## Estrutura de arquivos

```
backend/
├── src/
│   ├── services/whatsapp/
│   │   ├── BaileysClient.ts       # Conexão WebSocket + reconect automático
│   │   ├── WhatsAppService.ts     # Singleton: envio, rate-limit, despacha templates
│   │   ├── MessageTemplates.ts    # 5 templates de mensagem por status de pedido
│   │   └── types.ts               # Tipos TypeScript compartilhados
│   ├── controllers/
│   │   └── WhatsAppController.ts  # Handlers HTTP (status, send, notify-order)
│   ├── routes/
│   │   └── whatsapp.routes.ts     # Rotas Express montadas em /whatsapp
│   ├── utils/
│   │   ├── logger.ts              # Pino logger com pretty-print colorido
│   │   └── phoneUtils.ts          # Normalização/validação de telefone BR
│   ├── app.ts                     # Express setup: CORS, middlewares, rotas
│   └── server.ts                  # Entry point: conecta Baileys → sobe HTTP
│
├── auth_info_baileys/             # Sessão local (NUNCA commitar — gitignored)
├── .env.example
├── package.json
└── tsconfig.json

src/services/
├── whatsapp.service.ts            # Funções do frontend que chamam o backend
└── whatsapp.types.ts              # Tipo OrderStatus para o frontend
```

---

## Instalação

```bash
cd backend
npm install
cp .env.example .env
```

Variáveis do `.env`:

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `WPP_PORT` | `3001` | Porta do servidor HTTP |
| `LOG_LEVEL` | `info` | Nível de log (trace/debug/info/warn/error) |
| `CORS_ORIGIN` | `*` | Origem permitida no CORS |

---

## Rodando

### Desenvolvimento

```bash
cd backend
npm run dev
```

### Produção

```bash
cd backend
npm run build
npm start
```

---

## Autenticação (QR Code)

Na **primeira execução**, o QR aparece no terminal:

```
[WPP] QR Code gerado — escaneie com seu celular:

███████████████████
█ ▄▄▄▄▄ ██▄█ ▄▄▄▄▄ █
...

[WPP] Abra o WhatsApp no celular:
[WPP]  ⚙️  Menu > Dispositivos conectados > Adicionar
```

Após escanear: `[WPP] ✅ Conectado ao WhatsApp com sucesso!`

A sessão é salva em `backend/auth_info_baileys/` e **reutilizada automaticamente** nas próximas execuções.

> Se o número for deslogado manualmente pelo celular, apague a pasta `auth_info_baileys/` e reinicie.

---

## Endpoints HTTP

### `GET /health`

```json
{ "ok": true, "service": "pdv-whatsapp", "ts": "2025-05-26T12:00:00.000Z" }
```

---

### `GET /whatsapp/status`

Estado da conexão. Útil para exibir um indicador no painel admin.

```json
{
  "ok": true,
  "connected": true,
  "state": "connected",
  "qrCode": null,
  "uptime": 3600
}
```

Possíveis valores de `state`:

| Estado | Significado |
|--------|-------------|
| `connecting` | Iniciando conexão |
| `qr_ready` | Aguardando scan do QR |
| `connected` | Pronto para enviar |
| `disconnected` | Sem conexão, tentando reconectar |

---

### `POST /whatsapp/send`

Mensagem de texto livre.

```json
{
  "phone": "11987654321",
  "message": "Texto da mensagem"
}
```

O campo `phone` aceita qualquer formato BR: `11987654321`, `(11) 98765-4321`, `5511987654321`.

---

### `POST /whatsapp/notify-order`

Notificação de pedido usando template.

```json
{
  "phone": "11987654321",
  "customerName": "João",
  "orderId": "42",
  "status": "confirmed",
  "estimatedTime": 30,
  "total": 49.90
}
```

| Campo | Obrigatório | Descrição |
|-------|:-----------:|-----------|
| `phone` | ✅ | Telefone do cliente |
| `customerName` | ✅ | Nome para personalizar |
| `orderId` | ✅ | ID do pedido |
| `status` | ✅ | Ver tabela de status abaixo |
| `estimatedTime` | — | Minutos (padrão: 30), usado em `confirmed` |
| `total` | — | Valor em R$, exibido em `confirmed` |

---

## Templates de mensagem

### `confirmed`
```
✅ Pedido #42 confirmado!

Olá, João! 👋
Seu pedido foi recebido e já está sendo preparado.

⏱️ Tempo estimado: 30 minutos
💰 Total: R$ 49,90

Obrigado por escolher a gente! 🍔
```

### `preparing`
```
👨‍🍳 Pedido #42 em preparo!

João, sua comanda está na cozinha.
Em breve ficará prontinho! 🔥
```

### `out_for_delivery`
```
🛵 Pedido #42 saiu para entrega!

Boa notícia, João!
Seu pedido está a caminho. Fique de olho na porta! 📍
```

### `ready_for_pickup`
```
🎉 Pedido #42 pronto para retirada!

João, pode vir buscar!
Seu pedido está te esperando aqui. 🏃
```

### `cancelled`
```
❌ Pedido #42 cancelado

Olá, João.
Infelizmente seu pedido precisou ser cancelado.
Entre em contato para mais informações.
```

---

## Integrando ao fluxo de pedidos

Importe de `src/services/whatsapp.service.ts`:

```ts
import { notificarStatusPedido } from '@/services/whatsapp.service'
```

### Ao criar pedido

```ts
await notificarStatusPedido({
  phone: pedido.phone,
  customerName: pedido.cliente,
  orderId: pedido.id,
  status: 'confirmed',
  estimatedTime: 30,
  total: pedido.total,
})
```

### Ao atualizar status

```ts
await notificarStatusPedido({
  phone: pedido.phone,
  customerName: pedido.cliente,
  orderId: pedido.id,
  status: 'out_for_delivery',  // ou outro status
})
```

### Mapeamento `PedidoStatus` → `OrderStatus`

| Status no PDV | Status para o template |
|---------------|----------------------|
| `'Recebido'` | `'confirmed'` |
| `'Em preparo'` | `'preparing'` |
| `'Finalizado'` (tipo entrega) | `'out_for_delivery'` |
| `'Finalizado'` (tipo retirada) | `'ready_for_pickup'` |
| `'Cancelado'` | `'cancelled'` |

> As chamadas são **best-effort**: se o backend estiver fora, o fluxo do pedido não é interrompido.

---

## Reconexão automática

| Situação | Comportamento |
|----------|---------------|
| Queda de rede | Aguarda 5s e tenta novamente (máx. 5 tentativas) |
| Logout pelo celular | Log de aviso + `process.exit(1)` |
| 5 tentativas sem sucesso | Log de erro + `process.exit(1)` |
| Novo QR gerado | Imprime no terminal + emite evento `qr` |

---

## Variáveis no `.env` da raiz do projeto

```env
# Frontend aponta para o backend Baileys
VITE_WPP_URL=http://localhost:3001

# Printer-backend usa para fazer proxy de /send-whatsapp
WPP_BACKEND_URL=http://localhost:3001
```

---

## Cuidados para evitar bloqueio

| ✅ Faça | ❌ Evite |
|---------|---------|
| Use um número dedicado (chip barato) | Usar número pessoal |
| Só envie para clientes que pediram | Envio em massa / marketing |
| Mantenha o delay entre mensagens | Remover o rate-limit do código |
| Rode sempre na mesma rede/IP | Trocar de IP frequentemente |
| Humanize o número (foto, nome) | Número recém-criado sem histórico |
| Proteja `auth_info_baileys/` | Commitar a sessão no git |

---

## Teste rápido

```bash
# Health check
curl http://localhost:3001/health

# Status da conexão
curl http://localhost:3001/whatsapp/status

# Mensagem livre
curl -X POST http://localhost:3001/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{"phone":"11987654321","message":"Teste 🍔"}'

# Notificação de pedido confirmado
curl -X POST http://localhost:3001/whatsapp/notify-order \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "11987654321",
    "customerName": "João",
    "orderId": "42",
    "status": "confirmed",
    "estimatedTime": 30,
    "total": 49.90
  }'
```
