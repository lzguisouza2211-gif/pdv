-- Produtos do cardápio
CREATE TABLE cardapio (
  id BIGSERIAL PRIMARY KEY,
  categoria TEXT NOT NULL,
  nome TEXT NOT NULL,
  preco NUMERIC NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  disponivel BOOLEAN NOT NULL DEFAULT true,
  ingredientes JSONB NOT NULL DEFAULT '[]',
  criado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cardapio_categoria_nome_unique UNIQUE (categoria, nome)
);

-- Adicionais por produto
CREATE TABLE adicional (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES cardapio(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  preco NUMERIC NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT adicional_product_nome_unique UNIQUE (product_id, nome)
);

-- Removíveis por produto
CREATE TABLE retirar_ingred (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES cardapio(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT retirar_ingred_product_nome_unique UNIQUE (product_id, nome)
);

-- Pedidos
CREATE TABLE pedidos (
  id BIGSERIAL PRIMARY KEY,
  cliente TEXT NOT NULL,
  phone VARCHAR,
  tipoentrega TEXT NOT NULL CHECK (tipoentrega IN ('retirada', 'entrega', 'local')),
  endereco TEXT,
  numero TEXT,
  bairro TEXT,
  itens JSONB NOT NULL DEFAULT '[]',
  formapagamento TEXT NOT NULL CHECK (formapagamento IN ('dinheiro', 'cartao', 'pix')),
  troco NUMERIC,
  taxa_entrega NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'Recebido' CHECK (status IN ('Recebido', 'Em preparo', 'Finalizado')),
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Itens normalizados do pedido (preenchidos via trigger)
CREATE TABLE pedido_itens (
  id BIGSERIAL PRIMARY KEY,
  pedido_id BIGINT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  quantidade NUMERIC NOT NULL,
  preco NUMERIC NOT NULL,
  categoria TEXT,
  adicionais JSONB DEFAULT '[]',
  retirados JSONB DEFAULT '[]',
  extras TEXT,
  adicionais_retirados TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pedido_itens_unique UNIQUE (pedido_id, nome, observacoes)
);

-- Ingredientes indisponíveis do dia
CREATE TABLE ingredientes_indisponiveis_dia (
  id BIGSERIAL PRIMARY KEY,
  ingrediente TEXT NOT NULL,
  indisponivel BOOLEAN NOT NULL DEFAULT false,
  pg BOOLEAN NOT NULL DEFAULT false,
  valid_on DATE NOT NULL DEFAULT CURRENT_DATE,
  CONSTRAINT ingredientes_indisponiveis_dia_unique UNIQUE (ingrediente, valid_on)
);

CREATE UNIQUE INDEX ingredientes_indisponiveis_dia_ingrediente_idx
  ON ingredientes_indisponiveis_dia (ingrediente);

-- Estado da loja
CREATE TABLE store_status (
  id BIGINT PRIMARY KEY DEFAULT 1,
  is_open BOOLEAN NOT NULL DEFAULT true,
  tempo_espera_padrao NUMERIC NOT NULL DEFAULT 30,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Configuração de taxa de entrega
CREATE TABLE delivery_config (
  id BIGINT PRIMARY KEY DEFAULT 1,
  taxa_entrega NUMERIC NOT NULL DEFAULT 5,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fechamentos de caixa
CREATE TABLE fechamentos_caixa (
  id BIGSERIAL PRIMARY KEY,
  data DATE NOT NULL,
  periodo TEXT NOT NULL CHECK (periodo IN ('dia', 'mes')),
  total NUMERIC NOT NULL DEFAULT 0,
  total_pedidos INTEGER NOT NULL DEFAULT 0,
  pix_valor NUMERIC NOT NULL DEFAULT 0,
  pix_quantidade INTEGER NOT NULL DEFAULT 0,
  dinheiro_valor NUMERIC NOT NULL DEFAULT 0,
  dinheiro_quantidade INTEGER NOT NULL DEFAULT 0,
  cartao_valor NUMERIC NOT NULL DEFAULT 0,
  cartao_quantidade INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fila de notificações WhatsApp
CREATE TABLE whatsapp_notifications (
  id BIGSERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Templates de mensagem WhatsApp
CREATE TABLE whatsapp_templates (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  template TEXT NOT NULL
);

-- Admins
CREATE TABLE admins (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
