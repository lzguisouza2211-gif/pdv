# Mapa do Projeto — PDV Lanchonete

> Estado atual do projeto, atualizado automaticamente após cada commit.

---

## Front-end

### Telas (Área PDV)
- Cardápio com categorias e produtos
- Carrinho (CartDrawer) com customização de itens
- Modal de customização de produtos (sabores, ingredientes)
- Modal de confirmação de pedido (SuccessModal)
- Modal de telefone (PhonePromptModal)
- Exibição de chave PIX

### Telas (Área Admin)
- Dashboard com métricas gerais
- Financeiro com gráficos detalhados
- Kanban de pedidos (status em colunas)
- Gestão do cardápio (categorias, produtos, ingredientes)
- Gestão de clientes
- Monitor de pedidos (OrderMonitor)
- Novo pedido manual
- Pedidos (listagem)
- WhatsApp (integração Baileys)
- Impressora (configuração)
- Login

### Telas (Área Garçom)
- Interface simplificada para atendimento em mesa

---

## Back-end

### Serviços
- Backend WhatsApp (Baileys) — porta 3001
- Printer backend (impressão térmica) — Node.js standalone
- Supabase (BaaS — banco, auth, realtime)

### Funcionalidades de Back-end
- Autenticação via Supabase Auth
- Realtime subscriptions (pedidos em tempo real)
- Notificações WhatsApp via Baileys
- Impressão térmica de pedidos

---

## Tecnologias

### Core
- React 18
- TypeScript
- Vite
- Electron (wrapper desktop)

### UI
- Tailwind CSS
- Shadcn/ui (componentes)
- Radix UI (primitivos)

### Estado e Dados
- Zustand (estado global)
- Supabase JS SDK
- React Query (provável)

### Back-end
- Node.js
- Baileys (WhatsApp Web API)
- Supabase (PostgreSQL + Auth + Realtime)

### Build / Deploy
- Electron Builder (empacotamento desktop)
- Vite (bundler frontend)

---

## Funcionalidades

### Operacional
- [x] Cardápio digital com categorias
- [x] Pedidos com customização (sabores, remoção de ingredientes)
- [x] Carrinho com cálculo de totais
- [x] Fluxo de pagamento PIX
- [x] Impressão térmica de pedidos
- [x] Kanban de status de pedidos

### Gestão
- [x] Dashboard com métricas
- [x] Painel financeiro com gráficos
- [x] CRUD de produtos e categorias
- [x] Gestão de ingredientes e disponibilidade
- [x] Cadastro de clientes
- [x] Log de status de pedidos

### Comunicação
- [x] Notificações WhatsApp (Baileys)
- [x] Pedidos em tempo real (Supabase Realtime)

### Plataforma
- [x] App desktop (Electron)
- [x] Interface web (browser)

---

## Integrações

- **Supabase** — banco de dados PostgreSQL, autenticação e realtime
- **WhatsApp (Baileys)** — envio de notificações e confirmações
- **Impressora térmica** — impressão via backend Node.js local

---

## Controle de Versão

- Diretório `mind/` ignorado pelo git (anotações e estudos locais)
