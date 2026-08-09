-- 024_conversas_ia.sql
-- Fundação do Atendente IA via WhatsApp (Fase 0 — ver docs/atendente-ia-arquitetura.md).
--
-- Nenhuma IA ainda: essas tabelas só armazenam o estado de conversa e o
-- histórico bruto de mensagens capturadas pelo backend WhatsApp.
--
-- Escrita é feita exclusivamente pelo backend Node via service_role
-- (bypassa RLS) — não há policy de INSERT/UPDATE para anon/authenticated
-- porque nenhum outro cliente deve gravar conversa de cliente diretamente.

CREATE TABLE conversas_ia (
  id                   BIGSERIAL PRIMARY KEY,
  phone                VARCHAR(20) NOT NULL UNIQUE,
  modo                 TEXT NOT NULL DEFAULT 'ia' CHECK (modo IN ('ia', 'humano')),
  motivo_transferencia TEXT,
  ultima_atividade_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mensagens_ia (
  id          BIGSERIAL PRIMARY KEY,
  conversa_id BIGINT NOT NULL REFERENCES conversas_ia(id) ON DELETE CASCADE,
  direcao     TEXT NOT NULL CHECK (direcao IN ('entrada', 'saida')),
  autor       TEXT NOT NULL CHECK (autor IN ('cliente', 'ia', 'humano')),
  conteudo    TEXT NOT NULL,
  tool_calls  JSONB,
  criado_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX mensagens_ia_conversa_idx ON mensagens_ia (conversa_id, criado_at);

ALTER TABLE conversas_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens_ia ENABLE ROW LEVEL SECURITY;

-- Leitura liberada para admin autenticado (painel de conversas, Fase 3).
-- Escrita fica só com service_role (sem policy = sem acesso para anon/authenticated).
CREATE POLICY conversas_ia_select_admin ON conversas_ia
  FOR SELECT TO authenticated USING (true);

CREATE POLICY mensagens_ia_select_admin ON mensagens_ia
  FOR SELECT TO authenticated USING (true);
