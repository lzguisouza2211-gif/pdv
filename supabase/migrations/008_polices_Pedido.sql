-- Remove policies específicas de anon (sb_publishable_ mapeia para role diferente)
DROP POLICY IF EXISTS allow_anon_insert_pedidos ON pedidos;
DROP POLICY IF EXISTS allow_anon_select_pedidos ON pedidos;
DROP POLICY IF EXISTS allow_anon_update_pedidos ON pedidos;

-- Policies para public (cobre todos os roles)
CREATE POLICY allow_public_insert_pedidos ON pedidos
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY allow_public_select_pedidos ON pedidos
  FOR SELECT TO public USING (true);

CREATE POLICY allow_public_update_pedidos ON pedidos
  FOR UPDATE TO public USING (true) WITH CHECK (true);

-- pedido_itens (preenchido pelo trigger SECURITY DEFINER, mas SELECT precisa de policy)
DROP POLICY IF EXISTS pedido_itens_insert ON pedido_itens;
DROP POLICY IF EXISTS pedido_itens_select ON pedido_itens;

CREATE POLICY allow_public_insert_pedido_itens ON pedido_itens
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY allow_public_select_pedido_itens ON pedido_itens
  FOR SELECT TO public USING (true);
