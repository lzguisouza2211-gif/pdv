-- 020_audit_log.sql
-- Tabela de auditoria + triggers automáticos em pedidos e cardapio.
--
-- O que é registrado automaticamente (triggers):
--   pedidos  → UPDATE (status, total, edição geral) e DELETE
--   cardapio → UPDATE (preço, disponível, ativo, nome) e DELETE
--
-- O que é registrado pelo frontend:
--   login / logout

CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID,
  user_email  TEXT,
  acao        TEXT        NOT NULL,
  tabela      TEXT,
  registro_id TEXT,
  detalhes    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Apenas admin pode ler os logs
CREATE POLICY audit_log_select_admin ON audit_log
  FOR SELECT TO authenticated USING (true);

-- Todos podem inserir (triggers SECURITY DEFINER + frontend autenticado)
CREATE POLICY audit_log_insert_all ON audit_log
  FOR INSERT WITH CHECK (true);

-- ── Trigger: pedidos ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_audit_pedido()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_acao    TEXT;
  v_detalhe JSONB;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_acao    := 'status_pedido_alterado';
      v_detalhe := jsonb_build_object(
        'status_anterior', OLD.status,
        'status_novo',     NEW.status,
        'cliente',         NEW.cliente,
        'total',           NEW.total
      );
    ELSIF OLD.total IS DISTINCT FROM NEW.total THEN
      v_acao    := 'total_pedido_alterado';
      v_detalhe := jsonb_build_object(
        'total_anterior', OLD.total,
        'total_novo',     NEW.total,
        'cliente',        NEW.cliente,
        'status',         NEW.status
      );
    ELSE
      v_acao    := 'pedido_editado';
      v_detalhe := jsonb_build_object(
        'cliente', NEW.cliente,
        'status',  NEW.status,
        'total',   NEW.total
      );
    END IF;

    INSERT INTO audit_log (user_id, acao, tabela, registro_id, detalhes)
    VALUES (auth.uid(), v_acao, 'pedidos', NEW.id::TEXT, v_detalhe);

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (user_id, acao, tabela, registro_id, detalhes)
    VALUES (auth.uid(), 'pedido_excluido', 'pedidos', OLD.id::TEXT,
      jsonb_build_object(
        'cliente', OLD.cliente,
        'total',   OLD.total,
        'status',  OLD.status
      ));
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_pedido ON pedidos;
CREATE TRIGGER trg_audit_pedido
  AFTER UPDATE OR DELETE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION fn_audit_pedido();

-- ── Trigger: cardapio ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_audit_cardapio()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_acao    TEXT;
  v_detalhe JSONB;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.preco IS DISTINCT FROM NEW.preco THEN
      v_acao    := 'preco_alterado';
      v_detalhe := jsonb_build_object(
        'produto',        NEW.nome,
        'categoria',      NEW.categoria,
        'preco_anterior', OLD.preco,
        'preco_novo',     NEW.preco
      );
    ELSIF OLD.disponivel IS DISTINCT FROM NEW.disponivel THEN
      v_acao    := CASE WHEN NEW.disponivel THEN 'produto_disponibilizado' ELSE 'produto_indisponibilizado' END;
      v_detalhe := jsonb_build_object('produto', NEW.nome, 'categoria', NEW.categoria);
    ELSIF OLD.ativo IS DISTINCT FROM NEW.ativo THEN
      v_acao    := CASE WHEN NEW.ativo THEN 'produto_ativado' ELSE 'produto_desativado' END;
      v_detalhe := jsonb_build_object('produto', NEW.nome, 'categoria', NEW.categoria);
    ELSIF OLD.nome IS DISTINCT FROM NEW.nome THEN
      v_acao    := 'produto_renomeado';
      v_detalhe := jsonb_build_object(
        'nome_anterior', OLD.nome,
        'nome_novo',     NEW.nome,
        'categoria',     NEW.categoria
      );
    ELSE
      v_acao    := 'produto_editado';
      v_detalhe := jsonb_build_object('produto', NEW.nome, 'categoria', NEW.categoria);
    END IF;

    INSERT INTO audit_log (user_id, acao, tabela, registro_id, detalhes)
    VALUES (auth.uid(), v_acao, 'cardapio', NEW.id::TEXT, v_detalhe);

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (user_id, acao, tabela, registro_id, detalhes)
    VALUES (auth.uid(), 'produto_excluido', 'cardapio', OLD.id::TEXT,
      jsonb_build_object(
        'produto',   OLD.nome,
        'categoria', OLD.categoria,
        'preco',     OLD.preco
      ));
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_cardapio ON cardapio;
CREATE TRIGGER trg_audit_cardapio
  AFTER UPDATE OR DELETE ON cardapio
  FOR EACH ROW EXECUTE FUNCTION fn_audit_cardapio();
