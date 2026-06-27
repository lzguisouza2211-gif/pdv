# Architecture Decisions

> Registro de decisões arquiteturais relevantes tomadas ao longo do projeto.
> Cada entrada responde: o quê, por quê, alternativas e impacto.

---

## Análise Financeira Agregada Client-Side

**Decisão:** As novas análises de faturamento por categoria e breakdown por tipo de entrega são calculadas no cliente iterando sobre os pedidos já carregados, usando `Map` para acumulação, sem queries SQL adicionais.

**Motivo:** Os pedidos do período já são buscados em uma única query Supabase. Fazer queries separadas para cada nova métrica aumentaria a complexidade e o número de round-trips sem ganho proporcional, dado o volume típico de um PDV de lanchonete.

**Alternativas:** Views ou funções SQL no Supabase retornando os agregados diretamente (mais eficiente em volumes maiores); uso de biblioteca de analytics/BI; React Query com queries separadas por métrica.

**Impacto:** Funciona bem para o volume atual. Se o período selecionado passar a retornar milhares de pedidos (ex.: relatório anual), a iteração client-side pode se tornar lenta e será necessário migrar os agregados para o banco. A estrutura de tipos `CategoryData` e `EntregaData` já está bem definida para facilitar essa migração futura.
