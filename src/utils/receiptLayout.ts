import { Pedido } from '@/types'

const COL = 30
const SEP = '-'.repeat(COL)
const STRONG_SEP = '='.repeat(24)
const FOOTER_BLANK_LINES = 4

function clip(text: string, max: number): string {
  if (max <= 0) return ''
  return text.length <= max ? text : text.slice(0, max)
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function wrapLine(text: string, width = COL): string[] {
  const clean = normalizeText(text)
  if (!clean) return ['']

  const words = clean.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    if (!current) {
      current = clip(word, width)
      continue
    }

    const candidate = `${current} ${word}`
    if (candidate.length <= width) {
      current = candidate
      continue
    }

    lines.push(current)
    current = clip(word, width)
  }

  if (current) lines.push(current)
  return lines
}

function pushWrapped(lines: string[], text: string, indent = ''): void {
  const chunkWidth = Math.max(1, COL - indent.length)
  const parts = wrapLine(text, chunkWidth)
  for (const part of parts) lines.push(indent + part)
}

function pushTopic(lines: string[], label: string, value: string): void {
  const prefix = `${label}: `
  if (prefix.length >= COL - 1) {
    pushWrapped(lines, `${prefix}${value}`)
    return
  }

  const parts = wrapLine(value, COL - prefix.length)
  if (parts.length === 0) {
    lines.push(prefix.trimEnd())
    return
  }

  lines.push(prefix + parts[0])
  const indent = ' '.repeat(prefix.length)
  for (let i = 1; i < parts.length; i++) {
    lines.push(indent + parts[i])
  }
}

function pad(left: string, right: string, total = COL): string {
  const rightSafe = clip(normalizeText(right), Math.max(0, total - 1))
  const leftMax = Math.max(1, total - rightSafe.length - 1)
  const leftSafe = clip(normalizeText(left), leftMax)
  const spaces = total - leftSafe.length - rightSafe.length
  return leftSafe + ' '.repeat(Math.max(1, spaces)) + rightSafe
}

function center(text: string, total = COL): string {
  const clean = clip(normalizeText(text), total)
  const spaces = Math.max(0, Math.floor((total - clean.length) / 2))
  return ' '.repeat(spaces) + clean
}

const pgLabel: Record<string, string> = {
  dinheiro: 'DINHEIRO',
  cartao: 'CARTAO',
  pix: 'PIX',
}

export function buildProductionReceipt(pedido: Pedido): string {
  const time = new Date(pedido.created_at).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const lines: string[] = [
    STRONG_SEP,
    center('PRODUCAO'),
    pad(`Pedido #${pedido.id}`, time),
    SEP,
  ]

  for (const item of pedido.itens) {
    pushWrapped(lines, `${item.quantidade}x ${item.nome}`)
    for (const a of item.adicionais) lines.push(pad(`+ ${a.nome}`, a.preco.toFixed(2).replace('.', ',')))
    for (const r of item.retirados) pushWrapped(lines, `- sem ${r.nome}`, '  ')
    if (item.observacoes) pushWrapped(lines, `Obs: ${item.observacoes}`, '  ')
    lines.push('')
  }

  lines.push(SEP)
  if (pedido.tipoentrega === 'entrega') lines.push(center('DELIVERY'))
  if (pedido.tipoentrega === 'local') lines.push(center('MESA'))
  lines.push(`Pagamento: ${pgLabel[pedido.formapagamento] ?? pedido.formapagamento}`)

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
    center('Luizão Lanches'),
    pad(`Pedido #${pedido.id}`, time),
    SEP,
  ]

  let subtotal = 0
  for (const item of pedido.itens) {
    const lineTotal = item.preco * item.quantidade
    subtotal += lineTotal
    lines.push(pad(`${item.quantidade}x ${item.nome}`, fmt(item.preco)))
    for (const a of item.adicionais) lines.push(pad(`+ ${a.nome}`, fmt(a.preco)))
    for (const r of item.retirados) pushWrapped(lines, `- sem ${r.nome}`, '  ')
    if (item.observacoes) pushWrapped(lines, `Obs: ${item.observacoes}`, '  ')
  }

  lines.push(SEP)
  lines.push(pad('Subtotal:', fmt(subtotal)))
  if (pedido.taxa_entrega > 0)
    lines.push(pad('Taxa entrega:', fmt(pedido.taxa_entrega)))
  lines.push(pad('TOTAL:', fmt(pedido.total)))
  lines.push(SEP)

  lines.push(`Pagamento: ${pgLabel[pedido.formapagamento] ?? pedido.formapagamento}`)
  if (pedido.troco && pedido.troco > 0) {
    const valorPago = pedido.troco + pedido.total
    lines.push(`Troco p/ R$${fmt(valorPago)}:${' '.repeat(4)}${fmt(pedido.troco)}`)
  }

  lines.push(SEP)
  lines.push(`Cliente: ${pedido.cliente}`)
  if (pedido.phone) lines.push(`Tel: ${pedido.phone}`)
  if (pedido.endereco)
    lines.push(`End: ${pedido.endereco}, ${pedido.numero} - ${pedido.bairro}`)

  return lines.join('\n')
}

export function buildCombinedReceipt(pedido: Pedido): string {
  const time = new Date(pedido.created_at).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })

  const lines: string[] = [
    'Luizao Lanches',
    STRONG_SEP,
    `Pedido: #${pedido.id}`,
    `Hora: ${time}`,
    SEP,
  ]

  let subtotal = 0
  for (const [index, item] of pedido.itens.entries()) {
    const lineTotal = item.preco * item.quantidade
    subtotal += lineTotal
    pushTopic(lines, `Item ${index + 1}`, `${item.quantidade}x ${item.nome}`)
    pushTopic(lines, 'Valor', fmt(item.preco))
    for (const a of item.adicionais) {
      pushTopic(lines, 'Adicional', `${a.nome} (${fmt(a.preco)})`)
    }
    for (const r of item.retirados) {
      pushTopic(lines, 'Retirar', r.nome)
    }
    if (item.observacoes) {
      pushTopic(lines, 'Obs', item.observacoes)
    }
    pushTopic(lines, 'Total item', fmt(lineTotal))
    lines.push(SEP)
  }

  pushTopic(lines, 'Subtotal', fmt(subtotal))
  if (pedido.taxa_entrega > 0) pushTopic(lines, 'Taxa entrega', fmt(pedido.taxa_entrega))
  pushTopic(lines, 'Total', fmt(pedido.total))
  lines.push(SEP)

  const tipoEntrega =
    pedido.tipoentrega === 'entrega'
      ? 'DELIVERY'
      : pedido.tipoentrega === 'local'
        ? 'MESA'
        : 'RETIRADA'
  pushTopic(lines, 'Tipo', tipoEntrega)
  pushTopic(lines, 'Pagamento', pgLabel[pedido.formapagamento] ?? pedido.formapagamento)
  if (pedido.troco && pedido.troco > 0) {
    const valorPago = pedido.troco + pedido.total
    pushTopic(lines, 'Troco para', fmt(valorPago))
    pushTopic(lines, 'Troco', fmt(pedido.troco))
  }

  lines.push(SEP)
  pushTopic(lines, 'Cliente', pedido.cliente)
  if (pedido.phone) pushTopic(lines, 'Telefone', pedido.phone)
  if (pedido.endereco) {
    pushTopic(lines, 'Endereco', `${pedido.endereco}, ${pedido.numero} - ${pedido.bairro}`)
  }

  lines.push('', SEP)

  for (let i = 0; i < FOOTER_BLANK_LINES; i++) {
    lines.push(' ')
  }

  return lines.join('\n')
}
