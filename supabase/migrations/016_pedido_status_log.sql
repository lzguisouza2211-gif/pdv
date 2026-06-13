  -- Histórico de mudanças de status dos pedidos para métricas de tempo
CREATE TABLE pedido_status_log (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id   BIGINT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK (status IN ('Recebido', 'Em preparo', 'Finalizado', 'Cancelado')),
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para consultas por pedido e por data
CREATE INDEX idx_pedido_status_log_pedido_id ON pedido_status_log(pedido_id);
CREATE INDEX idx_pedido_status_log_changed_at ON pedido_status_log(changed_at);

-- RLS: mesma política dos pedidos (acesso autenticado)
ALTER TABLE pedido_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso autenticado ao status log"
  ON pedido_status_log
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Popula o log com o status inicial dos pedidos já existentes (usando created_at como referência)
INSERT INTO pedido_status_log (pedido_id, status, changed_at)
SELECT id, status, created_at
FROM pedidos;
