# Learning Log

> Aprendizados técnicos registrados automaticamente a partir do código implementado.
> Foco em conceitos, padrões e descobertas que valem a pena rever no futuro.

---

## 27/06/2026

**Contexto:** Expansão do relatório financeiro com análise de faturamento por categoria e breakdown de tipos de entrega, usando agregação client-side sobre os dados já carregados.

**Aprendizados:**
- **Agregação client-side com `Map`**: em vez de queries SQL separadas para cada análise, o código itera sobre o array de pedidos já carregado e usa `Map<string, {}>` para acumular faturamento por categoria e por tipo de entrega. Essa abordagem evita round-trips extras ao Supabase e funciona bem quando o volume de pedidos por período cabe em memória.
- **Set como flag de feature por categoria**: o padrão `const CUSTOM_CATS = new Set([...])` repetido em vários componentes (`ProductCard`, `CartDrawer`, `EditarPedidoModal`) é a forma adotada no projeto para controlar quais categorias habilitam comportamentos especiais (customização, seleção de sabores). Ao adicionar uma nova categoria, é necessário atualizar cada `Set` relevante — padrão funcional mas com risco de inconsistência entre componentes.
- **Relatórios HTML gerados no cliente**: o relatório impresso é construído como string HTML pura no cliente e enviado para impressão via `window.print()` ou equivalente. Isso permite personalização total do layout sem dependência de biblioteca de PDF, mas exige cuidado ao sincronizar os dados calculados (estados React) com o conteúdo gerado.
- **Constantes de estilo por tipo com Record**: o padrão `Record<string, { text, bar, border }>` para `ENTREGA_COLORS` e `Record<string, React.ReactNode>` para `ENTREGA_ICONS` permite mapear chaves de banco (`retirada`, `entrega`, `local`) diretamente para classes Tailwind e componentes, sem switch/case.
