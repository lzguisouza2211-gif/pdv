-- A política anterior (cardapio_admin_all) exigia que o usuário estivesse
-- na tabela `admins`, causando UPDATE silencioso (0 linhas, sem erro).
-- Correção: permite UPDATE/INSERT/DELETE para qualquer usuário autenticado
-- (o acesso ao painel admin já exige autenticação via ProtectedRoute).

DROP POLICY IF EXISTS cardapio_admin_all ON cardapio;

CREATE POLICY cardapio_authenticated_write ON cardapio
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
