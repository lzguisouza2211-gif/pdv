import { Pedido } from '@/types'

const COL = 48

function pad(left: string, right: string, total = COL): string {
  const spaces = total - left.length - right.length
  return left + ' '.repeat(Math.max(1, spaces)) + right
}

function center(text: string, total = COL): string {
  const spaces = Math.max(0, Math.floor((total - text.length) / 2))
  return ' '.repeat(spaces) + text
}

const SEP = '-'.repeat(COL)

export function buildProductionReceipt(pedido: Pedido): string {
  const time = new Date(pedido.created_at).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const lines: string[] = [
    '='.repeat(COL),
    center('PRODUÇÃO'),
    pad(`Pedido #${pedido.id}`, time),
    SEP,
  ]

  for (const item of pedido.itens) {
    lines.push(`${item.quantidade}x ${item.nome}`)
    for (const a of item.adicionais) lines.push(`  + ${a.nome}`)
    for (const r of item.retirados) lines.push(`  - sem ${r.nome}`)
    if (item.observacoes) lines.push(`  Obs: ${item.observacoes}`)
    lines.push('')
  }

  lines.push(SEP)
  if (pedido.tipoentrega === 'entrega') lines.push(center('DELIVERY'))
  if (pedido.tipoentrega === 'local') lines.push(center('MESA'))
  lines.push('')

  return lines.join('\n')
}

export function buildDeliveryReceipt(pedido: Pedido): string {
  const time = new Date(pedido.created_at).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })

  const lines: string[] = [
    center('Lanchonete Luizão'),
    pad(`Pedido #${pedido.id}`, time),
    SEP,
  ]

  let subtotal = 0
  for (const item of pedido.itens) {
    const lineTotal = item.preco * item.quantidade
    subtotal += lineTotal
    lines.push(pad(`${item.quantidade}x ${item.nome}`, fmt(item.preco)))
    for (const a of item.adicionais) lines.push(pad(`  + ${a.nome}`, fmt(a.preco)))
    for (const r of item.retirados) lines.push(`  - sem ${r.nome}`)
    if (item.observacoes) lines.push(`  Obs: ${item.observacoes}`)
  }

  lines.push(SEP)
  lines.push(pad('Subtotal:', fmt(subtotal)))
  if (pedido.taxa_entrega > 0)
    lines.push(pad('Taxa entrega:', fmt(pedido.taxa_entrega)))
  lines.push(pad('TOTAL:', fmt(pedido.total)))
  lines.push(SEP)

  const pgMap: Record<string, string> = {
    dinheiro: 'DINHEIRO',
    cartao: 'CARTÃO',
    pix: 'PIX',
  }
  lines.push(`Pagamento: ${pgMap[pedido.formapagamento] ?? pedido.formapagamento}`)
  if (pedido.troco && pedido.troco > 0) {
    const valorPago = pedido.troco + pedido.total
    lines.push(`Troco p/ R$${fmt(valorPago)}:${' '.repeat(4)}${fmt(pedido.troco)}`)
  }

  lines.push(SEP)
  lines.push(`Cliente: ${pedido.cliente}`)
  if (pedido.phone) lines.push(`Tel: ${pedido.phone}`)
  if (pedido.endereco)
    lines.push(`End: ${pedido.endereco}, ${pedido.numero} - ${pedido.bairro}`)
  lines.push('')

  return lines.join('\n')
}
