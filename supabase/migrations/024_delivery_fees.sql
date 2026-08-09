-- Taxas de entrega por bairro
CREATE TABLE delivery_fees (
  id         BIGSERIAL PRIMARY KEY,
  bairro     TEXT NOT NULL,
  taxa       NUMERIC NOT NULL DEFAULT 0,
  ativo      BOOLEAN NOT NULL DEFAULT TRUE,
  ordem      INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT delivery_fees_bairro_unique UNIQUE (bairro)
);

ALTER TABLE delivery_fees ENABLE ROW LEVEL SECURITY;

-- leitura pública: checkout do cardápio calcula a taxa sem login
CREATE POLICY delivery_fees_select ON delivery_fees FOR SELECT USING (true);

-- escrita apenas admin
CREATE POLICY delivery_fees_admin ON delivery_fees FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM admins));

GRANT SELECT ON delivery_fees TO anon, authenticated;

CREATE TRIGGER trg_delivery_fees_updated_at
  BEFORE UPDATE ON delivery_fees
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
