-- 021_fix_status_log_rls.sql
-- Corrige duas policies ausentes que bloqueavam pedidos de usuários anônimos (mobile/cardápio).

-- 1. pedidos: policy de INSERT público sumiu (provavelmente reset do banco)
DROP POLICY IF EXISTS allow_public_insert_pedidos ON pedidos;
CREATE POLICY allow_public_insert_pedidos ON pedidos
  FOR INSERT TO public WITH CHECK (true);

-- 2. pedido_status_log: criada só com acesso autenticado (016_pedido_status_log.sql),
--    mas o cliente anônimo precisa inserir o status inicial 'Recebido' junto com o pedido.
DROP POLICY IF EXISTS allow_public_insert_pedido_status_log ON pedido_status_log;
CREATE POLICY allow_public_insert_pedido_status_log ON pedido_status_log
  FOR INSERT TO public WITH CHECK (true);
