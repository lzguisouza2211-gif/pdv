-- Trigger: ao inserir pedido, cria ou atualiza o cliente automaticamente
-- e vincula pedido.cliente_id ao cliente correspondente.

DROP TRIGGER IF EXISTS trg_pedido_registrar_cliente ON pedidos;
DROP FUNCTION IF EXISTS fn_pedido_registrar_cliente();

CREATE OR REPLACE FUNCTION fn_pedido_registrar_cliente()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cliente_id BIGINT;
  v_tem_endereco BOOLEAN;
BEGIN
  -- Ignora pedidos sem telefone
  IF NEW.phone IS NULL OR trim(NEW.phone) = '' THEN
    RETURN NEW;
  END IF;

  v_tem_endereco := (
    NEW.tipoentrega = 'entrega'
    AND NEW.endereco IS NOT NULL
    AND trim(NEW.endereco) != ''
  );

  INSERT INTO clientes (
    nome, phone,
    total_pedidos, total_gasto, ultima_compra,
    tipoentrega, endereco, numero, bairro
  )
  VALUES (
    NEW.cliente, NEW.phone,
    1, NEW.total, NOW(),
    CASE WHEN v_tem_endereco THEN NEW.tipoentrega ELSE NULL END,
    CASE WHEN v_tem_endereco THEN NEW.endereco    ELSE NULL END,
    CASE WHEN v_tem_endereco THEN NEW.numero      ELSE NULL END,
    CASE WHEN v_tem_endereco THEN NEW.bairro      ELSE NULL END
  )
  ON CONFLICT (phone) DO UPDATE SET
    total_pedidos = clientes.total_pedidos + 1,
    total_gasto   = clientes.total_gasto + NEW.total,
    ultima_compra = NOW(),
    tipoentrega   = CASE WHEN v_tem_endereco THEN NEW.tipoentrega ELSE clientes.tipoentrega END,
    endereco      = CASE WHEN v_tem_endereco THEN NEW.endereco    ELSE clientes.endereco    END,
    numero        = CASE WHEN v_tem_endereco THEN NEW.numero      ELSE clientes.numero      END,
    bairro        = CASE WHEN v_tem_endereco THEN NEW.bairro      ELSE clientes.bairro      END
  RETURNING id INTO v_cliente_id;

  NEW.cliente_id := v_cliente_id;

  RETURN NEW;
END;
$$;

-- BEFORE INSERT para poder setar NEW.cliente_id atomicamente
CREATE TRIGGER trg_pedido_registrar_cliente
  BEFORE INSERT ON pedidos
  FOR EACH ROW
  EXECUTE FUNCTION fn_pedido_registrar_cliente();
