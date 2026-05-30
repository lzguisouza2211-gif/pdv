# PDV Lanchonete

Sistema completo de ponto de venda (PDV) para lanchonetes — cardápio digital para clientes, painel administrativo para cozinha/gestão, impressão térmica e notificações via WhatsApp. Funciona como aplicação web (browser) ou como app desktop (Electron) para Windows/Linux.

---

## Funcionalidades

**Cardápio (cliente)**
- Visualização de produtos por categoria
- Personalização de itens (adicionais, remoções, observações)
- Carrinho com cálculo automático de totais e troco
- Suporte a retirada, entrega e consumo local (mesa)
- Exibição de taxa de entrega e tempo estimado
- Aviso de loja fechada
- Pagamento via PIX com exibição de chave/QR

**Painel Administrativo (cozinha/gestão)**
- Monitor de pedidos em tempo real — Kanban (Recebido → Em preparo → Finalizado)
- Histórico de pedidos com busca e filtros
- Gerenciamento do cardápio (produtos, preços, disponibilidade)
- Controle de ingredientes indisponíveis do dia
- Relatório financeiro com fechamento de caixa
- Gestão de clientes (histórico, endereços, gastos)
- Criação manual de pedidos pelo operador
- Configuração de taxa de entrega e tempo de espera

**Integrações**
- Notificações de novos pedidos via WhatsApp (Baileys)
- Impressão de comprovantes/comandas em impressoras térmicas ESC/POS
- Auto-atualização do app Electron via GitHub Releases

**Interface Garçom**
- Página dedicada para atendimento em mesa

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui (Radix UI) |
| Estado | Zustand 5 |
| Roteamento | React Router v7 |
| Backend / DB | Supabase (PostgreSQL + RLS) |
| Desktop | Electron 33 + electron-builder + electron-updater |
| WhatsApp | Node.js + Express + Baileys (Whiskey Sockets) |
| Impressora | Node.js + @node-escpos (ESC/POS) |
| Gráficos | Recharts |

---

## Estrutura do projeto

```
pdv/
├── src/                          # Frontend React
│   ├── app/                      # App.tsx, AppRoutes.tsx
│   ├── components/
│   │   ├── admin/                # OrderMonitor, Kanban, QuickMenuManagement, PrintButton…
│   │   ├── pdv/                  # CartDrawer, ProductCard, PixKeyDisplay…
│   │   └── ui/                   # shadcn/ui components
│   ├── hooks/                    # useCardapio, usePedidos, useStoreStatus, useWhatsApp…
│   ├── pages/
│   │   ├── admin/                # Dashboard, KanbanPedidos, Pedidos, GestaoCardapio,
│   │   │                         # Financeiro, Clientes, WhatsApp, Impressora, NovoPedido
│   │   ├── auth/                 # Login
│   │   ├── garcom/               # GarcomPage
│   │   └── pdv/                  # Cardapio
│   ├── services/
│   │   ├── api/                  # cardapio, pedidos, ingredientes, storeStatus, deliveryFee, clientes
│   │   ├── printer/              # productionReceipt, deliveryReceipt, printQueue
│   │   ├── supabaseClient.ts
│   │   └── whatsapp.service.ts
│   ├── store/                    # useCart, useUser, usePedidosStore (Zustand)
│   ├── types/                    # tipos globais + electron.d.ts
│   └── utils/                    # calc, validation, pedido, receiptLayout
├── backend/                      # Servidor WhatsApp (Node.js independente)
│   ├── src/
│   │   ├── server.ts
│   │   ├── controllers/          # WhatsAppController
│   │   ├── services/whatsapp/    # BaileysClient, WhatsAppService, MessageTemplates
│   │   └── routes/               # whatsapp.routes.ts
│   └── package.json
├── electron/                     # App desktop
│   └── main/
│       ├── main.ts               # Processo principal
│       ├── preload.ts            # Bridge IPC
│       ├── ipc/                  # handlers (printer, whatsapp)
│       └── services/             # PrinterService, BaileysClient integrado, OrderNotifier
├── supabase/
│   └── migrations/               # 001–014 — schema, RLS, triggers, seeds, updates
├── scripts/                      # generate-credentials.mjs, postbuild-electron.mjs
├── printer-backend.js            # Servidor de impressão standalone
├── vercel.json
└── .env.example
```

---

## Configuração

### 1. Pré-requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com) (plano gratuito suficiente)

### 2. Clone e instale

```bash
git clone https://github.com/seu-usuario/pdv-lanchonete.git
cd pdv-lanchonete
npm install
```

### 3. Variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` com suas credenciais:

```env
# Supabase (obrigatório)
VITE_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

# Backend de impressão (opcional)
VITE_BACKEND_URL=http://localhost:3000/
PRINTER_NAME=Printer POS-80          # nome da impressora no Windows
PRINTER_PATH=                        # porta serial: COM3 / /dev/usb/lp0

# Backend WhatsApp (opcional)
VITE_WPP_URL=http://localhost:3001
WPP_BACKEND_URL=http://localhost:3001

# Auto-update Electron (opcional)
GH_TOKEN=ghp_xxxxx
```

As chaves do Supabase estão em: **Dashboard → Project Settings → API**.

### 4. Banco de dados

Execute as migrations em ordem no **Supabase SQL Editor** ou via CLI:

```bash
npx supabase db push
```

| Migration | Conteúdo |
|---|---|
| `001_create_tables.sql` | Schema completo |
| `002_rls_policies.sql` | Row Level Security |
| `003_triggers_functions.sql` | Triggers (cópia de itens, updated_at) |
| `004_seed_cardapio.sql` | Produtos iniciais |
| `005_seed_adicionais.sql` | Adicionais por produto |
| `006_seed_ingredientes_indisponiveis.sql` | Ingredientes do dia |
| `007_seed_config.sql` | Configurações iniciais |
| `008_polices_Pedido.sql` | Políticas adicionais de pedidos |
| `009–014_*.sql` | Clientes, atualizações de schema e políticas |

> A função `fn_copiar_itens_pedido` usa `SECURITY DEFINER` para popular `pedido_itens` via trigger sem conflito de RLS.

---

## Desenvolvimento

### Web (browser)

```bash
npm run dev
```

| URL | Descrição |
|---|---|
| `http://localhost:5173/` | Cardápio público |
| `http://localhost:5173/garcom` | Interface garçom |
| `http://localhost:5173/admin` | Painel administrativo |
| `http://localhost:5173/login` | Login |

### App Electron (desktop)

```bash
npm run electron:dev
```

### Backend de impressão (opcional)

```bash
npm run printer          # porta 3000
```

### Backend WhatsApp (opcional)

```bash
cd backend
npm install
npm run dev              # porta 3001
```

---

## Rotas

| Rota | Descrição |
|---|---|
| `/` | Cardápio público |
| `/garcom` | Interface do garçom |
| `/login` | Autenticação admin |
| `/admin` | Dashboard (KPIs, resumo) |
| `/admin/pedidos` | Kanban de pedidos em tempo real |
| `/admin/historico` | Histórico de pedidos |
| `/admin/cardapio` | Gestão do cardápio |
| `/admin/financeiro` | Relatório financeiro / fechamento de caixa |
| `/admin/clientes` | Gestão de clientes |
| `/admin/pedido` | Criar pedido manual |
| `/admin/whatsapp` | Configuração do WhatsApp |
| `/admin/impressora` | Configuração da impressora |

---

## Build

### Web (produção)

```bash
npm run build
```

Saída em `dist/` — pronta para Vercel, Netlify ou qualquer host estático.

### Electron — Windows

```bash
npm run electron:pack:win
```

### Electron — Linux

```bash
npm run electron:build
```

O instalador gerado fica em `release/`.

---

## Observações técnicas

- **RLS:** Todas as tabelas têm Row Level Security ativado. As policies de `pedidos` e `pedido_itens` permitem acesso público (`TO public`) pois o cardápio não exige autenticação de cliente.
- **Chave Supabase:** O projeto usa o formato `sb_publishable_*` (não o JWT legacy). Requer `@supabase/supabase-js` v2.47+.
- **WhatsApp:** O backend Baileys salva a sessão em `backend/auth_info_baileys/`. Na primeira execução, escaneie o QR Code exibido no terminal.
- **Electron IPC:** O preload expõe uma bridge segura (`window.electronAPI`) isolando o renderer do processo principal.
- **Auto-update:** O Electron verifica atualizações via `electron-updater` apontando para GitHub Releases. Configure `GH_TOKEN` antes do build.
