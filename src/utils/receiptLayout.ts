import { Pedido } from '@/types'

const COL = 48
const SEP = '-'.repeat(COL)
const DSEP = '='.repeat(COL)
const BOLD_ON  = '\x1B\x45\x01'
const BOLD_OFF = '\x1B\x45\x00'

// --- Dados da lanchonete (edite aqui) ---
const STORE = {
  nome: 'LUIZÃO LANCHES',
  cnpj: '20.348.220/0001-18',
  endereco: 'Avenida Delfim Moreira 700 - Ouro Fino/MG',
}

function pad(left: string, right: string, total = COL): string {
  const spaces = total - left.length - right.length
  return left + ' '.repeat(Math.max(1, spaces)) + right
}

function center(text: string, total = COL): string {
  return ' '.repeat(Math.max(0, Math.floor((total - text.length) / 2))) + text
}

function fmtR$(v: number): string {
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

function fmtDateTime(isoStr: string): { date: string; time: string } {
  const d = new Date(isoStr)
  return {
    date: d.toLocaleDateString('pt-BR'),
    time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  }
}

const tipoLabel: Record<string, string> = {
  entrega: 'ENTREGA',
  retirada: 'RETIRADA',
  local: 'LOCAL',
}

const pgLabel: Record<string, string> = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  pix: 'PIX',
}

function pgStr(pedido: Pedido): string {
  const base = pgLabel[pedido.formapagamento] ?? pedido.formapagamento
  if (pedido.tipoentrega === 'entrega' && pedido.formapagamento !== 'pix') {
    return `${base} (Na Entrega)`
  }
  return base
}

export function buildProductionReceipt(pedido: Pedido): string {
  const { date, time } = fmtDateTime(pedido.created_at)
  const tipo = tipoLabel[pedido.tipoentrega] ?? pedido.tipoentrega.toUpperCase()

  const lines: string[] = [
    DSEP,
    pad(`PEDIDO: #${pedido.id}`, `${date} - ${time}`),
    pad(`TIPO: ${tipo}`, 'Mesa/Balcão: ---'),
    `CLIENTE: ${pedido.cliente}`,
    DSEP,
  ]

  const obsGlobal = pedido.itens
    .filter(i => i.observacoes)
    .map(i => `OBS (${i.nome}): ${i.observacoes}`)

  if (obsGlobal.length > 0) {
    lines.push(...obsGlobal)
    lines.push(SEP)
  }

  lines.push('ITENS:')
  lines.push(SEP)

  let total = 0
  for (const item of pedido.itens) {
    const adicionaisSum = (item.adicionais ?? []).reduce((s, a) => s + a.preco * (a.qty ?? 1), 0)
    const basePreco = item.preco - adicionaisSum
    const itemTotal = item.preco * item.quantidade
    total += itemTotal
    lines.push(BOLD_ON + pad(`- ${item.quantidade} ${item.nome}`, fmtR$(basePreco * item.quantidade)) + BOLD_OFF)
    for (const r of item.retirados) lines.push(`  (SEM ${r.nome.toUpperCase()})`)
    for (const a of item.adicionais ?? []) {
      const aqty = a.qty ?? 1
      const addTotal = a.preco * aqty * item.quantidade
      const label = aqty > 1 ? `${aqty}x ${a.nome}` : a.nome
      if (addTotal > 0) {
        lines.push(pad(`  (COM ${label.toUpperCase()})`, fmtR$(addTotal)))
      } else {
        lines.push(`  ${label.toUpperCase()}`)
      }
    }
    if (item.observacoes) lines.push(`  Obs: ${item.observacoes}`)
  }

  lines.push(SEP)
  if (pedido.taxa_entrega > 0) {
    lines.push(pad('SUBTOTAL:', fmtR$(total - pedido.taxa_entrega)))
    lines.push(pad('TAXA ENTREGA:', fmtR$(pedido.taxa_entrega)))
    lines.push(SEP)
  }
  lines.push(pad('TOTAL:', fmtR$(pedido.total)))
  lines.push(DSEP)
  lines.push('')
  lines.push('')
  lines.push('')

  return lines.join('\n')
}

export function buildDeliveryReceipt(pedido: Pedido): string {
  const { date, time } = fmtDateTime(pedido.created_at)

  const lines: string[] = [
    SEP,
    center(STORE.nome),
    center(`CNPJ: ${STORE.cnpj}`),
    center(STORE.endereco),
    SEP,
    pad(`PEDIDO #${pedido.id}`, `${date} - ${time}`),
    SEP,
  ]

  lines.push(`CLIENTE: ${pedido.cliente}`)
  if (pedido.phone) lines.push(`TELEFONE: ${pedido.phone}`)
  if (pedido.tipoentrega === 'entrega' && pedido.endereco) {
    const parts = [pedido.endereco, pedido.numero, pedido.bairro].filter(Boolean)
    lines.push(`ENTREGA: ${parts.join(', ')}`)
  }

  lines.push(SEP)
  lines.push('ITENS DO PEDIDO:')
  lines.push(SEP)

  let subtotal = 0
  let qtdItens = 0

  for (const item of pedido.itens) {
    // item.preco já inclui adicionais (com qty) — calcula base separado para exibir cada extra
    const adicionaisUnitSum = (item.adicionais ?? []).reduce((s, a) => s + a.preco * (a.qty ?? 1), 0)
    const basePreco = item.preco - adicionaisUnitSum
    const baseTotal = basePreco * item.quantidade
    subtotal += baseTotal
    qtdItens += item.quantidade
    lines.push(BOLD_ON + pad(`${item.quantidade} ${item.nome}`, fmtR$(baseTotal)) + BOLD_OFF)
    for (const r of item.retirados) lines.push(`  - Sem ${r.nome}`)
    for (const a of item.adicionais ?? []) {
      const aqty = a.qty ?? 1
      const addTotal = a.preco * aqty * item.quantidade
      subtotal += addTotal
      const label = aqty > 1 ? `${aqty}x ${a.nome}` : a.nome
      if (addTotal > 0) {
        lines.push(pad(`  + ${label}`, fmtR$(addTotal)))
      } else {
        lines.push(`  ${label}`)
      }
    }
    if (item.observacoes) lines.push(`  Obs: ${item.observacoes}`)
  }

  lines.push(SEP)
  lines.push(`QTD. ITENS: ${qtdItens}`)
  lines.push(SEP)
  if (pedido.taxa_entrega > 0) {
    lines.push(pad('SUBTOTAL:', fmtR$(subtotal)))
    lines.push(pad('TAXA ENTREGA:', fmtR$(pedido.taxa_entrega)))
    lines.push(SEP)
  }
  lines.push(pad('TOTAL A PAGAR:', fmtR$(pedido.total)))
  lines.push(SEP)

  lines.push('FORMA DE PAGAMENTO:')
  lines.push(pgStr(pedido))
  if (pedido.troco && pedido.troco > 0) {
    const valorPago = pedido.troco + pedido.total
    lines.push(pad(`Troco p/ ${fmtR$(valorPago)}:`, fmtR$(pedido.troco)))
  }

  lines.push(SEP)
  lines.push(center('Obrigado pela preferencia!'))
  lines.push(center('Volte sempre!'))
  lines.push(SEP)
  lines.push('')
  lines.push('')
  lines.push('')

  return lines.join('\n')
}
