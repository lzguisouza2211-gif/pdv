INSERT INTO store_status (id, is_open, tempo_espera_padrao)
  VALUES (1, true, 30)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO delivery_config (id, taxa_entrega)
  VALUES (1, 5.00)
  ON CONFLICT (id) DO NOTHING;
