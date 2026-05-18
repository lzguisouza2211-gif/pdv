
ALTER TABLE pedidos DROP CONSTRAINT pedidos_status_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_status_check
  CHECK (status IN ('Recebido', 'Em preparo', 'Finalizado', 'Cancelado'));




ALTER TABLE pedidos REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE pedidos;

ALTER TABLE cardapio REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE cardapio;
