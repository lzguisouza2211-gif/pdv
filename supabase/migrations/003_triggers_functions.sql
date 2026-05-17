-- Trigger: copia itens do JSONB para pedido_itens ao criar pedido
CREATE OR REPLACE FUNCTION fn_copiar_itens_pedido()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  item JSONB;
BEGIN
  FOR item IN SELECT jsonb_array_elements(NEW.itens) LOOP
    INSERT INTO pedido_itens (pedido_id, nome, quantidade, preco, categoria, adicionais, retirados, observacoes)
    VALUES (
      NEW.id,
      item->>'nome',
      (item->>'quantidade')::NUMERIC,
      (item->>'preco')::NUMERIC,
      item->>'categoria',
      COALESCE(item->'adicionais', '[]'),
      COALESCE(item->'retirados', '[]'),
      item->>'observacoes'
    )
    ON CONFLICT (pedido_id, nome, observacoes) DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_copiar_itens_pedido
  AFTER INSERT ON pedidos
  FOR EACH ROW EXECUTE FUNCTION fn_copiar_itens_pedido();

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pedidos_updated_at
  BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
