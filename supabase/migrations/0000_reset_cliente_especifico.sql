-- =============================================================
-- RESET DE CLIENTE DE TESTE
-- Apaga os pedidos e o registro do cliente pelo telefone.
-- Ajuste a variável v_phone abaixo antes de rodar.
-- =============================================================

DO $$
DECLARE
  v_phone  TEXT := '(35) 99894-3978';   -- << TELEFONE DO CLIENTE TESTE
  v_id     BIGINT;
BEGIN
  -- Busca o id do cliente
  SELECT id INTO v_id FROM clientes WHERE phone = v_phone;

  IF v_id IS NULL THEN
    RAISE NOTICE 'Cliente com phone % não encontrado.', v_phone;
    RETURN;
  END IF;

  -- Remove vínculo dos pedidos com o cliente (mantém o histórico de pedidos intacto)
  UPDATE pedidos SET cliente_id = NULL WHERE cliente_id = v_id;

  -- Apaga os pedidos que têm esse telefone (os pedidos de teste em si)
  DELETE FROM pedidos WHERE phone = v_phone;

  -- Apaga o cliente
  DELETE FROM clientes WHERE id = v_id;

  RAISE NOTICE 'Cliente % (id=%) e seus pedidos foram removidos.', v_phone, v_id;
END;
$$;
