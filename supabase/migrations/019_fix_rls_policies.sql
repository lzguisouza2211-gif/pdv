-- 019_fix_rls_policies.sql
-- Corrige policies permissivas criadas em migrações anteriores.
--
-- Modelo de acesso correto:
--   anon/public  → INSERT pedidos (cardápio público), SELECT cardápio/adicionais/store_status/delivery_config
--   authenticated → tudo (painel admin — login obrigatório via ProtectedRoute)

-- ── PEDIDOS ──────────────────────────────────────────────────────────────────
-- Problema: allow_public_select e allow_public_update permitiam que qualquer
-- pessoa sem login lesse e alterasse qualquer pedido.

DROP POLICY IF EXISTS allow_public_select_pedidos       ON pedidos;
DROP POLICY IF EXISTS allow_public_update_pedidos       ON pedidos;
DROP POLICY IF EXISTS pedidos_select                    ON pedidos;
DROP POLICY IF EXISTS pedidos_update                    ON pedidos;

-- Somente admin (autenticado) pode ler, editar e excluir pedidos
CREATE POLICY pedidos_select_admin ON pedidos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY pedidos_update_admin ON pedidos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY pedidos_delete_admin ON pedidos
  FOR DELETE TO authenticated USING (true);

-- INSERT permanece público: cardápio online precisa criar pedidos sem login
-- (allow_public_insert_pedidos já existe — não recriar)

-- ── PEDIDO_ITENS ─────────────────────────────────────────────────────────────
-- Problema: SELECT público expunha todos os itens de todos os pedidos.

DROP POLICY IF EXISTS allow_public_select_pedido_itens  ON pedido_itens;
DROP POLICY IF EXISTS pedido_itens_select               ON pedido_itens;

CREATE POLICY pedido_itens_select_admin ON pedido_itens
  FOR SELECT TO authenticated USING (true);

-- INSERT mantido público: o trigger SECURITY DEFINER precisa inserir em
-- nome do role anon. Sem esta policy o INSERT do trigger seria bloqueado
-- caso o Supabase mude o comportamento de SECURITY DEFINER + RLS.
-- (allow_public_insert_pedido_itens já existe — não recriar)

-- ── ADICIONAL ────────────────────────────────────────────────────────────────
-- Problema: INSERT/UPDATE/DELETE sem nenhuma verificação de autenticação.

DROP POLICY IF EXISTS admin_insert_adicional            ON adicional;
DROP POLICY IF EXISTS admin_update_adicional            ON adicional;
DROP POLICY IF EXISTS admin_delete_adicional            ON adicional;
DROP POLICY IF EXISTS adicional_admin_all               ON adicional;

CREATE POLICY adicional_write_admin ON adicional
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- SELECT permanece público (cardápio precisa ler adicionais/sabores)
-- (adicional_select já existe — não recriar)

-- ── INGREDIENTES_INDISPONIVEIS_DIA ───────────────────────────────────────────
-- Problema: policy "ingredientes_all" permitia escrita sem autenticação.

DROP POLICY IF EXISTS ingredientes_all                  ON ingredientes_indisponiveis_dia;

CREATE POLICY ingredientes_write_admin ON ingredientes_indisponiveis_dia
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── FECHAMENTOS_CAIXA ────────────────────────────────────────────────────────
-- A policy original referenciava a tabela `admins` com subquery.
-- Simplificamos: apenas autenticados (admin) acessam.

DROP POLICY IF EXISTS fechamentos_admin                 ON fechamentos_caixa;

CREATE POLICY fechamentos_caixa_admin ON fechamentos_caixa
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── RETIRAR_INGRED ───────────────────────────────────────────────────────────
-- Garantir que escrita também exige autenticação.

DROP POLICY IF EXISTS retirar_admin_all                 ON retirar_ingred;

CREATE POLICY retirar_write_admin ON retirar_ingred
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
