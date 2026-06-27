# LinkedIn Ideas

> Ideias de posts geradas automaticamente a partir das implementações do projeto.
> Conteúdo técnico, educativo e natural — sem marketing forçado.

---

## 27/06/2026 — Relatório financeiro: faça seus dados trabalharem mais sem queries extras

**O problema:** Toda vez que precisava de uma nova métrica no painel financeiro (faturamento por categoria, breakdown por tipo de entrega, média de itens por pedido), a tentação era criar uma nova query no banco. Resultado: 5 métricas novas = 5 round-trips extras, código espalhado e loading states para gerenciar.

**Como resolvi:** Os pedidos do período já estavam em memória após a query principal. Bastou iterar sobre esse array com `Map` para acumular o que precisava:

```ts
const catMap = new Map<string, { quantidade: number; total: number }>()
for (const pedido of pedidos) {
  for (const item of pedido.itens) {
    const ex = catMap.get(item.categoria) ?? { quantidade: 0, total: 0 }
    catMap.set(item.categoria, {
      quantidade: ex.quantidade + item.quantidade,
      total: ex.total + item.preco * item.quantidade,
    })
  }
}
```

Uma iteração, três métricas novas. Zero queries extras.

**O aprendizado:** Antes de criar uma nova query, pergunte: "esses dados já estão em algum estado carregado?" Em sistemas transacionais com volume moderado, a agregação client-side é frequentemente mais simples e igualmente rápida.

**Dica para outros devs:** Defina os tipos antes (`CategoryData`, `EntregaData`) — eles forçam você a pensar na estrutura do dado e tornam a iteração mais segura com TypeScript. E documente quando esse padrão começa a escalar mal: anote o volume máximo esperado para que o próximo dev saiba quando migrar para SQL.
