# Changelog

> Registro automático de alterações gerado por IA após cada commit.
> Entradas mais recentes aparecem no topo.

---

## 27/06/2026

**Commit:** feat: adiciona categoria Chicletes com sabores e expande relatório financeiro

**Implementações:**
- Nova categoria **Chicletes** integrada em todos os pontos do sistema: adicionada ao `CUSTOM_CATS` em `ProductCard`, `CartDrawer` e `EditarPedidoModal`, e ao `CATS_COM_SABOR` em `QuickMenuManagement`, permitindo seleção de sabores no fluxo de pedido
- Estilo visual para Chicletes definido: emoji 🍬 e tint verde claro `#E8F5E9`, propagado em `ProductCard` e `ProductCustomizationModal`
- Categorias **Bebidas** e **Doces** também adicionadas ao `CATS_COM_SABOR` no painel de gestão do cardápio
- Migração Supabase (`018_seed_chicletes.sql`) inserindo os produtos iniciais da categoria Chicletes no banco
- Relatório financeiro (`Financeiro.tsx`) expandido com três novas análises:
  - **Faturamento por categoria**: agrupa itens dos pedidos por `item.categoria`, calcula quantidade e total, exibe card com barras de progresso proporcionais ao faturamento total
  - **Breakdown por tipo de entrega** (`retirada`, `entrega`, `local`): conta pedidos, soma faturamento e taxas de entrega por tipo, com cores e ícones distintos (`Bike`, `ShoppingCart`, `UtensilsCrossed`)
  - **Média de itens por pedido**: calcula `totalQtd / pedidos.length` e exibe no card de pedidos
- Relatório impresso (HTML) atualizado para incluir tabelas de faturamento por categoria e por tipo de entrega, além de `mediaItens` e `taxaEntregaTotal` no cabeçalho do relatório
- Novos tipos TypeScript: `CategoryData` e `EntregaData` para tipagem das estruturas de análise

**Arquivos principais:**
- `src/pages/admin/Financeiro.tsx` — expansão do relatório financeiro com novas análises e visualizações
- `src/components/pdv/ProductCard.tsx` — novo estilo visual Chicletes e expansão do `CUSTOM_CATS`
- `src/components/pdv/CartDrawer.tsx` — Bebidas e Chicletes habilitadas para customização no carrinho
- `src/components/admin/EditarPedidoModal.tsx` — Chicletes adicionada ao fluxo de edição de pedido
- `src/components/admin/QuickMenuManagement.tsx` — Chicletes e Doces com painel de sabores
- `src/components/pdv/ProductCustomizationModal.tsx` — estilo visual Chicletes no modal de customização
- `supabase/migrations/018_seed_chicletes.sql` — seed inicial dos produtos da categoria

---

## 27/06/2026

**Commit:** fix/mind no gitignore

**Implementações:**
- Adicionada entrada `mind` ao `.gitignore` com comentário `# estudos`, excluindo o diretório de anotações/estudos locais do versionamento git

**Arquivos principais:**
- `.gitignore`
