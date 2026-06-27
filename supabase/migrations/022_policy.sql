-- 022_policy.sql
-- Corrige dois problemas introduzidos pelo commit de segurança (migration 019):
--
-- BUG 1 (pedido mobile não era criado):
--   pedido_status_log foi criado sem GRANT para anon (migration 016).
--   O INSERT do status inicial ('Recebido') falhava com permission denied,
--   abortando toda a transação e reportando erro na tabela pedidos.
--
-- BUG 2 (WhatsApp de confirmação parou de enviar):
--   Migration 019 removeu allow_public_select_pedidos.
--   O OrderNotifier (Electron) usa chave anon no Realtime — sem SELECT,
--   o payload.new chega vazio e a notificação é silenciosamente ignorada.

-- ── GRANTs ausentes ──────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT ON pedido_status_log TO anon, authenticated;
GRANT SELECT, INSERT ON pedido_itens TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON clientes TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ── RLS: INSERT público em pedido_status_log (complementa o GRANT acima) ────
DROP POLICY IF EXISTS allow_public_insert_pedido_status_log ON pedido_status_log;
CREATE POLICY allow_public_insert_pedido_status_log ON pedido_status_log
  FOR INSERT TO public WITH CHECK (true);

-- ── RLS: SELECT público em pedidos (necessário para Realtime do OrderNotifier) ─
DROP POLICY IF EXISTS pedidos_select_public ON pedidos;
CREATE POLICY "pedidos_select_public" ON pedidos
  FOR SELECT TO public USING (true);
