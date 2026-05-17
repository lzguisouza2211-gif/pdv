ALTER TABLE cardapio ENABLE ROW LEVEL SECURITY;
ALTER TABLE adicional ENABLE ROW LEVEL SECURITY;
ALTER TABLE retirar_ingred ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredientes_indisponiveis_dia ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE fechamentos_caixa ENABLE ROW LEVEL SECURITY;

-- cardapio: leitura pública, escrita apenas admin
CREATE POLICY cardapio_select ON cardapio FOR SELECT USING (true);
CREATE POLICY cardapio_admin_all ON cardapio FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM admins));

-- adicional e retirar_ingred: leitura pública
CREATE POLICY adicional_select ON adicional FOR SELECT USING (true);
CREATE POLICY adicional_admin_all ON adicional FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM admins));
CREATE POLICY retirar_select ON retirar_ingred FOR SELECT USING (true);
CREATE POLICY retirar_admin_all ON retirar_ingred FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM admins));

-- pedidos: anônimo insere, admin faz tudo
CREATE POLICY pedidos_insert ON pedidos FOR INSERT WITH CHECK (true);
CREATE POLICY pedidos_select ON pedidos FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM admins));
CREATE POLICY pedidos_update ON pedidos FOR UPDATE
  USING (auth.uid() IN (SELECT user_id FROM admins));

-- pedido_itens: trigger insere, admin lê
CREATE POLICY pedido_itens_insert ON pedido_itens FOR INSERT WITH CHECK (true);
CREATE POLICY pedido_itens_select ON pedido_itens FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM admins));

-- ingredientes_indisponiveis_dia: leitura pública, escrita livre (worker + admin)
CREATE POLICY ingredientes_select ON ingredientes_indisponiveis_dia FOR SELECT USING (true);
CREATE POLICY ingredientes_all ON ingredientes_indisponiveis_dia FOR ALL USING (true);

-- store_status e delivery_config: leitura pública, escrita admin
CREATE POLICY store_status_select ON store_status FOR SELECT USING (true);
CREATE POLICY store_status_admin ON store_status FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM admins));
CREATE POLICY delivery_config_select ON delivery_config FOR SELECT USING (true);
CREATE POLICY delivery_config_admin ON delivery_config FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM admins));

-- fechamentos: apenas admin
CREATE POLICY fechamentos_admin ON fechamentos_caixa FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM admins));

-- whatsapp: sem restrição (worker usa service_role)
ALTER TABLE whatsapp_notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_templates DISABLE ROW LEVEL SECURITY;
