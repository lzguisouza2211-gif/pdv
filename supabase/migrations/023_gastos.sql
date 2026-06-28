-- Categorias de gasto (lista configurável)
CREATE TABLE categorias_gasto (
  id         BIGSERIAL PRIMARY KEY,
  origem     TEXT NOT NULL CHECK (origem IN ('pessoal', 'lanche')),
  nome       TEXT NOT NULL,
  ordem      INT NOT NULL DEFAULT 0,
  ativo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lançamentos de gastos
CREATE TABLE gastos (
  id              BIGSERIAL PRIMARY KEY,
  valor           NUMERIC NOT NULL,
  data            DATE NOT NULL DEFAULT CURRENT_DATE,
  origem          TEXT NOT NULL CHECK (origem IN ('pessoal', 'lanche')),
  categoria_id    BIGINT NOT NULL REFERENCES categorias_gasto(id),
  forma_pagamento TEXT NOT NULL CHECK (forma_pagamento IN ('dinheiro', 'cartao', 'pix')),
  fornecedor      TEXT,
  descricao       TEXT,
  user_id         UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX gastos_data_idx         ON gastos (data);
CREATE INDEX gastos_categoria_id_idx ON gastos (categoria_id);

-- RLS
ALTER TABLE categorias_gasto ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos            ENABLE ROW LEVEL SECURITY;

-- categorias_gasto: apenas admin
CREATE POLICY categorias_gasto_admin ON categorias_gasto FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM admins));

-- gastos: apenas admin
CREATE POLICY gastos_admin ON gastos FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM admins));

-- Seed das categorias
INSERT INTO categorias_gasto (origem, nome, ordem) VALUES
  ('pessoal', 'Mercado',      1),
  ('pessoal', 'Saúde',        2),
  ('pessoal', 'Variáveis',    3),
  ('pessoal', 'Fixos',        4),
  ('lanche',  'Mercadoria',   1),
  ('lanche',  'Bebidas',      2),
  ('lanche',  'Descartáveis', 3),
  ('lanche',  'Transporte',   4),
  ('lanche',  'Fixos',        5),
  ('lanche',  'Variáveis',    6);

CREATE TRIGGER trg_gastos_updated_at
  BEFORE UPDATE ON gastos
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
