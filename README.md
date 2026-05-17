# PDV Lanchonete

Sistema de ponto de venda (PDV) para lanchonetes — cardápio digital para clientes e painel administrativo para a cozinha/gestão.

## Funcionalidades

**Cardápio (cliente)**
- Visualização de produtos por categoria
- Personalização de itens (adicionais, remoções, observações)
- Carrinho com cálculo automático de totais e troco
- Suporte a retirada, entrega e consumo local
- Exibição de taxa de entrega e tempo estimado
- Aviso de loja fechada

**Painel Administrativo (cozinha/gestão)**
- Monitor de pedidos em tempo real com avanço de status (Recebido → Em preparo → Finalizado)
- Gerenciamento do cardápio (produtos, preços, disponibilidade)
- Controle de ingredientes indisponíveis do dia
- Relatório financeiro com fechamento de caixa
- Configuração de taxa de entrega e tempo de espera

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui (Radix UI) |
| Estado | Zustand |
| Backend / DB | Supabase (PostgreSQL + RLS) |
| Roteamento | React Router v7 |

## Estrutura do projeto

```
src/
├── app/              # AppRoutes, App
├── components/
│   ├── admin/        # OrderMonitor, QuickMenuManagement, ...
│   ├── pdv/          # CartDrawer, ProductCustomizationModal, ...
│   └── ui/           # shadcn/ui components
├── hooks/            # useCardapio, useStoreStatus, useDeliveryFee
├── pages/
│   ├── admin/        # Dashboard, Pedidos, GestaoCardapio, Financeiro
│   ├── auth/         # Login
│   └── pdv/          # Cardapio
├── services/
│   ├── api/          # pedidos, cardapio, ingredientes, storeStatus, deliveryFee
│   ├── printer/      # productionReceipt, deliveryReceipt, printQueue
│   └── supabaseClient.ts
├── store/            # useCart (Zustand)
├── types/            # tipos globais
└── utils/            # calc, validation, pedido
supabase/
└── migrations/       # 001 → 009 — schema, RLS, triggers, seeds
```

## Configuração

### 1. Pré-requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com)

### 2. Clone e instale

```bash
git clone https://github.com/seu-usuario/pdv-lanchonete.git
cd pdv-lanchonete
npm install
```

### 3. Variáveis de ambiente

Copie o arquivo de exemplo e preencha com suas credenciais do Supabase:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

As chaves estão em: **Supabase Dashboard → Project Settings → API**.

### 4. Banco de dados

Execute as migrations em ordem no **Supabase SQL Editor** (ou via CLI):

| Migration | Conteúdo |
|---|---|
| `001_create_tables.sql` | Schema completo |
| `002_rls_policies.sql` | Row Level Security |
| `003_triggers_functions.sql` | Triggers (cópia de itens, updated_at) |
| `004_seed_cardapio.sql` | Produtos iniciais |
| `005_seed_adicionais.sql` | Adicionais por produto |
| `006_seed_ingredientes_indisponiveis.sql` | Ingredientes do dia |
| `007_seed_config.sql` | Configurações iniciais (taxa, status) |
| `008_polices_Pedido.sql` | Políticas de acesso para pedidos |

> **Importante:** A função `fn_copiar_itens_pedido` usa `SECURITY DEFINER` para popular `pedido_itens` via trigger sem conflito de RLS.

Via CLI (após `supabase link`):

```bash
npx supabase db push
```

### 5. Desenvolvimento

```bash
npm run dev
```

Acesse:
- **Cardápio (cliente):** `http://localhost:5173/`
- **Admin:** `http://localhost:5173/admin`

## Rotas

| Rota | Descrição |
|---|---|
| `/` | Cardápio público |
| `/admin` | Dashboard geral |
| `/admin/pedidos` | Monitor de pedidos |
| `/admin/cardapio` | Gestão do cardápio |
| `/admin/financeiro` | Relatório financeiro |
| `/login` | Autenticação |

## Build para produção

```bash
npm run build
```

A saída fica em `dist/` — pronta para deploy em Vercel, Netlify ou qualquer host estático.

## Observações técnicas

- **RLS:** Todas as tabelas têm Row Level Security ativado. As policies de `pedidos` e `pedido_itens` permitem acesso público (`TO public`) pois o sistema usa a chave publishable do Supabase sem autenticação de usuário.
- **Chave Supabase:** O projeto usa o novo formato `sb_publishable_*` (não o JWT legacy). Certifique-se de usar `@supabase/supabase-js` v2.47+.
- **Trigger SECURITY DEFINER:** `fn_copiar_itens_pedido` roda com privilégios elevados para garantir a cópia dos itens para `pedido_itens` independente do role do chamador.
