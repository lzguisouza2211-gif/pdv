DO $$
DECLARE prod RECORD; ts TIMESTAMP := NOW();
BEGIN
  FOR prod IN SELECT id FROM cardapio WHERE categoria IN ('Lanches','Macarrão','Omeletes') LOOP
    -- Simples
    INSERT INTO adicional (product_id, nome, preco, ativo, ordem, created_at, updated_at)
    VALUES
      (prod.id,'milho',4.00,true,1,ts,ts),
      (prod.id,'batata',4.00,true,2,ts,ts),
      (prod.id,'presunto',4.00,true,3,ts,ts),
      (prod.id,'mussarela',4.00,true,4,ts,ts),
      (prod.id,'ovo',4.00,true,5,ts,ts),
      (prod.id,'abacaxi',4.00,true,6,ts,ts),
      (prod.id,'cebola',2.00,true,7,ts,ts)
    ON CONFLICT (product_id, nome) DO NOTHING;

    -- Especial
    INSERT INTO adicional (product_id, nome, preco, ativo, ordem, created_at, updated_at)
    VALUES
      (prod.id,'hamburguer',8.00,true,10,ts,ts),
      (prod.id,'calabresa',8.00,true,11,ts,ts),
      (prod.id,'pernil',8.00,true,12,ts,ts),
      (prod.id,'cheddar',8.00,true,13,ts,ts),
      (prod.id,'catupiry',8.00,true,14,ts,ts),
      (prod.id,'frango',8.00,true,15,ts,ts),
      (prod.id,'bacon',8.00,true,16,ts,ts),
      (prod.id,'contra-file',12.00,true,17,ts,ts)
    ON CONFLICT (product_id, nome) DO NOTHING;
  END LOOP;
END $$;
