-- =============================================================
-- SCRIPT DE RESET DO BANCO PARA NOVO CLIENTE
-- Execute no Supabase SQL Editor (Dashboard → SQL Editor)
-- =============================================================
-- Apaga: pedidos, clientes, fechamentos de caixa e notificações
-- Mantém: cardápio, configurações, admins
-- =============================================================

BEGIN;

TRUNCATE TABLE
  whatsapp_notifications,
  fechamentos_caixa,
  pedido_itens,
  pedidos,
  clientes
CASCADE;

ALTER SEQUENCE pedidos_id_seq                    RESTART WITH 1;
ALTER SEQUENCE pedido_itens_id_seq               RESTART WITH 1;
ALTER SEQUENCE fechamentos_caixa_id_seq          RESTART WITH 1;
ALTER SEQUENCE whatsapp_notifications_id_seq     RESTART WITH 1;
ALTER SEQUENCE clientes_id_seq                   RESTART WITH 1;

COMMIT;

-- Verificação
SELECT 'pedidos'               AS tabela, COUNT(*) AS registros FROM pedidos
UNION ALL
SELECT 'clientes',                        COUNT(*) FROM clientes
UNION ALL
SELECT 'fechamentos_caixa',               COUNT(*) FROM fechamentos_caixa
UNION ALL
SELECT 'whatsapp_notifications',          COUNT(*) FROM whatsapp_notifications;
