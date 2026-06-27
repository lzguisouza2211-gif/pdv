INSERT INTO cardapio (categoria, nome, descricao, preco, ativo, disponivel, ingredientes) VALUES
('Chicletes','chiclete','Chiclete',2.00,true,true,'[]')
ON CONFLICT (categoria, nome) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  preco = EXCLUDED.preco,
  ingredientes = EXCLUDED.ingredientes;

-- Sabores do chiclete (adicionais com preco = 0)
DO $$
DECLARE prod_id UUID;
BEGIN
  SELECT id INTO prod_id FROM cardapio WHERE categoria = 'Chicletes' AND nome = 'chiclete';
  IF prod_id IS NOT NULL THEN
    INSERT INTO adicional (product_id, nome, preco, ativo, ordem)
    VALUES
      (prod_id, 'menta',        0, true, 1),
      (prod_id, 'morango',      0, true, 2),
      (prod_id, 'tutti-frutti', 0, true, 3),
      (prod_id, 'melancia',     0, true, 4),
      (prod_id, 'uva',          0, true, 5),
      (prod_id, 'canela',       0, true, 6)
    ON CONFLICT (product_id, nome) DO NOTHING;
  END IF;
END $$;
