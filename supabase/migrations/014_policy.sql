-- Leitura pública (cardápio do cliente e admin)
CREATE POLICY "store_status: leitura pública"
  ON store_status FOR SELECT
  USING (true);

-- Escrita somente para admin autenticado
CREATE POLICY "store_status: escrita autenticado"
  ON store_status FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "delivery_config: leitura pública"
  ON delivery_config FOR SELECT
  USING (true);

CREATE POLICY "delivery_config: escrita autenticado"
  ON delivery_config FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
