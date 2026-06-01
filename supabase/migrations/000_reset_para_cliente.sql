-- ============================================================
-- RESET DO BANCO PARA INÍCIO DE USO PELO CLIENTE
-- Apaga dados transacionais; mantém cardápio, config e admins.
-- ============================================================

BEGIN;

-- 1. Dados de pedidos (cascata apaga pedido_itens via FK)
DELETE FROM pedidos;
ALTER SEQUENCE pedidos_id_seq RESTART WITH 1;
ALTER SEQUENCE pedido_itens_id_seq RESTART WITH 1;

-- 2. Clientes
DELETE FROM clientes;
ALTER SEQUENCE clientes_id_seq RESTART WITH 1;

-- 3. Fechamentos de caixa
DELETE FROM fechamentos_caixa;
ALTER SEQUENCE fechamentos_caixa_id_seq RESTART WITH 1;

-- 4. Fila de notificações WhatsApp
DELETE FROM whatsapp_notifications;
ALTER SEQUENCE whatsapp_notifications_id_seq RESTART WITH 1;

-- ============================================================
-- O que NÃO é apagado (configurações do cliente):
--   cardapio, adicional, retirar_ingred
--   store_status, delivery_config
--   whatsapp_templates
--   admins
-- ============================================================

COMMIT;
