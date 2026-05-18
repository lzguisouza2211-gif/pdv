CREATE TABLE clientes (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  phone VARCHAR(20) NOT NULL,
  total_pedidos INTEGER DEFAULT 0,
  total_gasto NUMERIC(10,2) DEFAULT 0,
  ultima_compra TIMESTAMPTZ,
  criado_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT clientes_phone_unique UNIQUE (phone)
);

CREATE INDEX clientes_phone_idx ON clientes(phone);

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_clientes"   ON clientes FOR SELECT USING (true);
CREATE POLICY "public_insert_clientes" ON clientes FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update_clientes" ON clientes FOR UPDATE USING (true);

CREATE TRIGGER set_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_id BIGINT REFERENCES clientes(id) ON DELETE SET NULL;

-- Função atômica para incrementar estatísticas do cliente
CREATE OR REPLACE FUNCTION fn_registrar_pedido_cliente(p_cliente_id BIGINT, p_valor NUMERIC)
RETURNS VOID LANGUAGE SQL SECURITY DEFINER AS $$
  UPDATE clientes
  SET
    total_pedidos = total_pedidos + 1,
    total_gasto   = total_gasto + p_valor,
    ultima_compra = NOW()
  WHERE id = p_cliente_id;
  $$;
