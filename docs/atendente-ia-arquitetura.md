# Arquitetura — Atendente IA via WhatsApp

> Documento de arquitetura para o Atendente IA integrado ao WhatsApp existente do PDV.
> Produzido em conversa entre Guilherme e Claude, com decisões registradas conforme discutidas.

---

## 1. Objetivos

- Automatizar o atendimento inicial via WhatsApp (hoje 100% manual após o redirecionamento do `/cardapio`).
- Permitir que o cliente monte um pedido conversando naturalmente, sem navegar em cardápio digital.
- Eliminar respostas incorretas de preço/estoque através de **tool use**: a IA nunca responde de memória, sempre consulta o sistema.
- Preservar controle humano sobre o que entra na cozinha (nenhum pedido pula etapa de visibilidade do operador).
- Permitir transferência fluida para atendimento humano quando a IA não resolve.

## 2. Escopo

### Dentro do escopo (v1)
- Conversa em linguagem natural sobre cardápio, preços, disponibilidade e status da loja.
- Montagem de pedido completo (itens, adicionais, endereço/retirada, forma de pagamento) via ferramentas que leem/escrevem no Supabase real.
- Criação do pedido no status `Recebido` (mesmo status default já usado hoje) — **nunca** `Em preparo` diretamente.
- Envio da chave PIX quando o cliente escolhe essa forma de pagamento; confirmação do pagamento continua manual (operador confere o comprovante).
- Transferência para humano (automática por incerteza, ou manual pelo operador) via toggle de "modo" por conversa.
- Indicador de "digitando..." enquanto a IA processa.
- Persistência de estado de conversa em Supabase (sobrevive a restart do backend).

### Fora do escopo (v1) — decisão explícita, não esquecimento
- Confirmação automática de pagamento (leitura de comprovante/OCR, webhook de PIX).
- Multi-atendente/múltiplos números de WhatsApp.
- Edição de pedido já criado via conversa (cliente que quer alterar pedido é transferido para humano).
- Reativação do cardápio de autoatendimento — os dois fluxos (cardápio e IA) não são a mesma frente de trabalho.

## 3. Estado real do sistema (ponto de partida)

Levantado diretamente do código em `backend/src/services/whatsapp/`:

- `BaileysClient` hoje é **write-only**: conecta, mantém sessão, expõe `sendText`. **Não existe listener de mensagem recebida** (`messages.upsert`) — este é o primeiro item do roadmap, não um detalhe incidental.
- Nenhuma dependência de LLM no `package.json`.
- Nenhuma tabela de conversa/mensagem no Supabase.
- `pedidos.status` já tem `'Recebido'` como default e primeiro valor do `CHECK` — a decisão de pedido-da-IA nascer em `Recebido` não exige migração de enum.
- `clientes` já guarda `endereco`, `numero`, `bairro`, `tipoentrega` por telefone (`phone` é `UNIQUE`) — reaproveitável para a IA não perguntar endereço de cliente recorrente.
- `store_status` já guarda `pix_key`, `pix_display_key`, `pix_recipient_name` e `is_open`/`tempo_espera_padrao`.
- `delivery_config.taxa_entrega` é uma taxa fixa única (não por distância) — simplifica a ferramenta de cálculo de frete.
- RLS hoje é permissivo para `anon`/`authenticated` nas tabelas envolvidas; o backend da IA deve usar a `service_role` key do Supabase (decisão já validada), ajustando policies pontuais se necessário.

## 4. Casos de uso

1. Cliente pergunta se tem um produto → IA consulta e responde com preço real.
2. Cliente monta pedido completo por texto → IA confirma itens e total antes de criar.
3. Cliente pergunta "cadê meu pedido" → IA consulta o último pedido pelo telefone.
4. Cliente manda algo fora do domínio (reclamação, pergunta ambígua, pedido de desconto) → IA transfere para humano.
5. Operador assume uma conversa manualmente pelo Admin → IA para de responder aquele número.
6. Conversa fica 60 minutos sem atividade → encerra/expira; a próxima mensagem começa do zero (novo contexto), e se estava em modo humano, volta para IA.
7. Cliente envia mensagem em grupo → ignorada integralmente.
8. Cliente envia imagem (ex.: comprovante PIX) → IA não tenta interpretar; responde com confirmação padrão ("recebemos, vamos confirmar") e marca a conversa para revisão humana do comprovante.

## 5. Fluxo principal (pedido feliz)

```
Cliente manda mensagem
        │
        ▼
BaileysClient emite evento de mensagem recebida
        │
        ▼
Filtro: é grupo? é do próprio número? → descarta
        │
        ▼
Persiste mensagem bruta em `mensagens_ia`
        │
        ▼
Busca/cria `conversas_ia` (phone) — expirada (>60min)? cria nova
        │
        ▼
Conversa está em modo "humano"? → só persiste, não aciona IA
        │
        ▼
Buffer de 2,5s (agrupa rajada de mensagens do mesmo número)
        │
        ▼
Envia presença "digitando..." via Baileys
        │
        ▼
Monta contexto: histórico da conversa + mensagens novas + system prompt + tools
        │
        ▼
Chama LLM (loop agentic, máx. 5 iterações de tool call)
        │
   ┌────┴─────────────────────────┐
   ▼                              ▼
Tool call (consulta/ação)    Resposta final em texto
   │                              │
   ▼                              ▼
Executa contra Supabase      Envia via BaileysClient
   │                              │
   └──────────┬───────────────────┘
              ▼
      Persiste resposta em `mensagens_ia`
              ▼
      Atualiza `ultima_atividade_at` da conversa
```

## 6. Componentes

- **BaileysClient** (existente, estendido): passa a emitir eventos de mensagem recebida (`messages.upsert`) e a expor `sendPresenceUpdate('composing'/'paused')`.
- **ConversationManager** (novo): orquestra buffer/debounce por telefone, decide modo (IA/humano), persiste mensagens, decide expiração de sessão.
- **AttendantAgent** (novo): monta prompt + tools, chama o LLM, executa o loop agentic, decide quando enviar texto final.
- **Tools** (novo, funções TypeScript puras que o agente pode invocar): thin wrappers sobre o Supabase existente, nada de lógica de negócio nova além do que o PDV já tem.
- **Admin — painel de conversas** (novo, front-end): lista conversas ativas, toggle IA/humano por conversa, histórico de mensagens.
- **Supabase**: fonte de verdade de cardápio, pedidos, clientes, config — reaproveitado, não duplicado.

## 7. Arquitetura (visão geral)

```
                    Cliente (WhatsApp)
                          │
                          ▼
                    BaileysClient
              (conexão única, já existe)
                          │
              mensagem recebida (evento)
                          │
                          ▼
                 ConversationManager
        (buffer, modo IA/humano, expiração 60min)
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
      modo = humano            modo = IA
      (só persiste,             │
       não chama LLM)           ▼
                          AttendantAgent
                       (loop agentic + tools)
                                │
                    ┌───────────┼────────────┐
                    ▼           ▼            ▼
              consultar_*   criar_pedido  transferir_
              (cardápio,    (status        para_humano
               loja, pix,    'Recebido')
               cliente,
               status pedido)
                    │           │            │
                    └───────────┴────────────┘
                                ▼
                            Supabase
                    (service_role, tabelas
                     existentes + conversas_ia/
                     mensagens_ia novas)
                                │
                                ▼
                   Admin (Kanban, painel de
                   conversas, financeiro)
```

## 8. Integrações

- **WhatsApp**: reaproveita a sessão Baileys já autenticada — não é uma segunda conexão, é o mesmo `BaileysClient` ganhando um listener de entrada.
- **LLM**: novo — API de chat com suporte a tool use (function calling). Chave de API só no backend (`.env`, nunca exposta ao front, seguindo o mesmo padrão do `WPP_API_KEY`).
- **Supabase**: reaproveita todas as tabelas de domínio existentes; adiciona duas tabelas novas de suporte à conversa.

## 9. APIs internas (novas rotas no backend existente)

Seguindo o padrão de `whatsapp.routes.ts` (mesma API key, mesmo rate limiter):

- `GET /whatsapp/conversas` — lista conversas ativas/recentes para o painel do Admin.
- `GET /whatsapp/conversas/:phone/mensagens` — histórico de uma conversa.
- `POST /whatsapp/conversas/:phone/modo` — `{ modo: 'ia' | 'humano' }`, toggle manual do operador.

Não é necessária rota pública nova — o Baileys já recebe as mensagens diretamente via socket, não via webhook HTTP.

## 10. Banco de dados (novo)

```sql
-- Estado da conversa por telefone
CREATE TABLE conversas_ia (
  id BIGSERIAL PRIMARY KEY,
  phone VARCHAR(20) NOT NULL UNIQUE,
  modo TEXT NOT NULL DEFAULT 'ia' CHECK (modo IN ('ia', 'humano')),
  motivo_transferencia TEXT,
  ultima_atividade_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Histórico bruto de mensagens (auditoria + contexto do LLM)
CREATE TABLE mensagens_ia (
  id BIGSERIAL PRIMARY KEY,
  conversa_id BIGINT NOT NULL REFERENCES conversas_ia(id) ON DELETE CASCADE,
  direcao TEXT NOT NULL CHECK (direcao IN ('entrada', 'saida')),
  autor TEXT NOT NULL CHECK (autor IN ('cliente', 'ia', 'humano')),
  conteudo TEXT NOT NULL,
  tool_calls JSONB,
  criado_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX mensagens_ia_conversa_idx ON mensagens_ia(conversa_id, criado_at);
```

Nada muda no schema de `pedidos`, `clientes`, `cardapio` — a IA escreve neles do mesmo jeito que o Admin escreve hoje.

**Expiração dos 60 minutos**: não é um job/cron — é checada no momento em que uma nova mensagem chega (`ultima_atividade_at` mais de 60min no passado → trata como conversa nova, reseta `modo` para `'ia'` se estava em `'humano'`, zera o contexto enviado ao LLM).

## 11. Estados da conversa

Decisão deliberada: **não** criar uma máquina de estados rígida (`coletando_endereco`, `aguardando_pagamento`, etc.) no banco. O LLM com histórico completo da conversa + tools já carrega esse "estado" implicitamente — formalizar isso em enum criaria sincronização dupla (estado no banco vs. estado que o modelo entende pelo texto) e é a fonte de bugs mais comum em bots baseados em máquina de estados explícita.

O único estado persistido e autoritativo é `conversas_ia.modo` (`ia` | `humano`), porque **esse** precisa ser consultado por outro processo (o `ConversationManager`, antes de decidir se chama o LLM).

## 12. Uso de IA

- **Modelo**: GPT-4o Mini (OpenAI) — bom custo-benefício para tool use e português informal, latência baixa. Não há necessidade de modelo topo de linha aqui: as tarefas são conversas curtas + chamadas de ferramenta estruturadas, não raciocínio complexo.
- **Tools expostas ao agente** (todas leem/escrevem via `service_role`, nunca aceitam preço/total vindo do próprio modelo):
  - `consultar_cardapio({ categoria? })`
  - `consultar_produto({ nome })`
  - `consultar_status_loja()` — aberta/fechada, tempo de espera
  - `consultar_taxa_entrega()`
  - `consultar_cliente({ phone })` — endereço salvo, se existir
  - `consultar_status_pedido({ phone })` — último pedido
  - `consultar_chave_pix()`
  - `criar_pedido({ itens, tipoentrega, endereco?, formapagamento, ... })` — **total sempre recalculado server-side a partir dos preços do `cardapio`**, nunca aceita total informado pela IA
  - `transferir_para_humano({ motivo })`
- **Loop agentic**: máximo de 5 chamadas de ferramenta por turno de resposta — trava de segurança contra loop infinito de tool call por alucinação.
- **Confirmação antes de criar pedido**: o `criar_pedido` só deve ser chamado depois que o cliente confirmar explicitamente o resumo (itens + total) na conversa — isso fica no system prompt como regra, não como trava técnica, mas é o ponto mais importante do prompt.

## 13. Regras de negócio

- Preço, estoque/disponibilidade e taxa de entrega **sempre** vêm de tool call — nunca de "conhecimento" do modelo.
- Pedido criado pela IA nasce em `Recebido`, idêntico a um pedido manual — nenhum tratamento especial no Kanban.
- Pagamento PIX: IA informa a chave e pede o comprovante; confirmação é sempre humana.
- Mensagens de grupo (`@g.us`) são descartadas antes de qualquer processamento.
- Imagem recebida (ex.: comprovante) não é analisada pela IA — vira sinalização para revisão humana.
- Conversa em modo `humano` nunca é respondida pela IA, mesmo que o toggle tenha sido ligado há muito tempo — só volta para IA por expiração de 60min de inatividade.

## 14. Custos

Modelo de custo por token, escala com volume de conversas — não com tempo. Para o volume esperado de uma lanchonete (dezenas de conversas/dia, cada uma com poucas mensagens + 2-4 tool calls), o custo mensal com GPT-4o Mini tende a ficar na casa de poucos dólares a algumas dezenas de dólares, mas **não cite esse número como definitivo para decisão de orçamento** — os preços de API mudam com frequência; confirme na página de pricing atual da OpenAI antes de assumir compromisso. Vale colocar um teto de gasto (alerta ou hard cap) na conta da OpenAI desde o primeiro dia, dado que é dinheiro saindo por uso, não assinatura fixa.

## 15. Segurança

- Chave de API do LLM só no backend, mesmo padrão do `WPP_API_KEY` (nunca no front, nunca em log).
- Nenhuma tool de desconto ou edição de preço exposta ao agente — elimina a classe inteira de ataque "convença a IA a te dar desconto via prompt injection".
- Total do pedido sempre recalculado server-side, nunca aceito como veio da resposta do modelo.
- Rate limit por telefone na entrada (reaproveitar o padrão de `express-rate-limit` já usado nas rotas de saída) — protege contra flood de mensagens gerando custo de API.
- `service_role` key do Supabase só no backend Node, nunca no front — mesmo cuidado que já existe hoje com as outras credenciais do projeto.
- Fallback explícito: se a chamada ao LLM falhar/der timeout, responde com mensagem genérica de instabilidade e marca a conversa para `humano` — nunca deixa o cliente sem resposta.

## 16. Escalabilidade

- Uma sessão Baileys = um número de WhatsApp = um ponto de contato. Suficiente para uma loja; múltiplas lojas/números exigiria repensar isso (fora do escopo agora).
- Node lida bem com múltiplas conversas concorrentes (I/O-bound); o gargalo real é a latência do LLM por chamada, não o backend.
- Se o volume crescer a ponto do custo de LLM virar relevante, o próximo passo natural é cache de respostas para perguntas repetitivas (ex.: "vocês abrem que horas") antes de otimizar infraestrutura.

## 17. Roadmap de implementação

**Fase 0 — Fundação (sem IA ainda)**
Listener de mensagem recebida no `BaileysClient`, filtro de grupo, tabelas `conversas_ia`/`mensagens_ia`, persistência bruta de toda mensagem trocada. Objetivo: provar que a captura é confiável antes de acoplar qualquer IA.

**Fase 1 — IA somente-leitura**
Agente responde perguntas (cardápio, preço, status da loja, PIX) mas `criar_pedido` fica desabilitado. Handoff manual via toggle no Admin. Objetivo: validar qualidade da conversa com risco operacional zero.

**Fase 2 — Criação de pedido**
Habilita `criar_pedido` com a regra de confirmação explícita antes de chamar a tool. Pedido nasce em `Recebido`, aparece no Kanban como qualquer outro.

**Fase 3 — Refinamentos operacionais**
Buffer/debounce de rajada, indicador "digitando", expiração de 60min, transferência automática por incerteza do modelo.

**Fase 4 — Ajuste fino**
Revisão de transcripts reais, ajuste do system prompt, medição de taxa de handoff e taxa de erro por tipo de pedido.

Cada fase é um ponto de decisão — não faz sentido implementar a Fase 2 sem primeiro validar a Fase 1 em produção com conversas reais.
