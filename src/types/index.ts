export type ItemCardapio = {
  id: string
  nome: string
  preco: number
  categoria: string
  ativo: boolean
  disponivel: boolean
  descricao?: string
  ingredientes: string[]
  ingredientes_indisponiveis: string[]
  proibeGratuidade: boolean
}

export type ExtraOption = {
  nome: string
  preco: number
  tipo: 'add' | 'remove'
  qty?: number  // quantidade do adicional (padrão 1); não aplicável a retirados
}

export type CartItem = {
  cartKey: string
  id: string
  name: string
  price: number
  qty: number
  categoria?: string
  observacoes?: string
  extras: ExtraOption[]
}

export type PedidoStatus = 'Recebido' | 'Em preparo' | 'Finalizado' | 'Cancelado'

export type PedidoStatusLog = {
  id: string
  pedido_id: string
  status: PedidoStatus
  changed_at: string
}
export type TipoEntrega = 'retirada' | 'entrega' | 'local'
export type FormaPagamento = 'dinheiro' | 'cartao' | 'pix'

export type PedidoItem = {
  nome: string
  preco: number
  quantidade: number
  categoria?: string
  observacoes?: string
  adicionais: ExtraOption[]
  retirados: ExtraOption[]
}

export type Pedido = {
  id: string
  cliente: string
  phone?: string
  tipoentrega: TipoEntrega
  endereco?: string
  numero?: string
  bairro?: string
  itens: PedidoItem[]
  formapagamento: FormaPagamento
  troco?: number
  taxa_entrega: number
  total: number
  status: PedidoStatus
  created_at: string
  updated_at: string
  cliente_id?: number
}

export interface Cliente {
  id: number
  nome: string
  phone: string
  total_pedidos: number
  total_gasto: number
  ultima_compra?: string
  criado_at: string
  updated_at: string
  tipoentrega?: TipoEntrega
  endereco?: string
  numero?: string
  bairro?: string
}

export type StoreStatus = {
  is_open: boolean
  tempo_espera_padrao: number
  pix_key?: string
  pix_display_key?: string
  pix_recipient_name?: string
}

export type Adicional = {
  id: string
  product_id: string
  nome: string
  preco: number
  ativo: boolean
  ordem: number
}

export type DeliveryFeeOption = {
  id: string
  bairro: string
  taxa: number
  ativo: boolean
  ordem: number
}

export type IngredienteIndisponivel = {
  id: string
  ingrediente: string
  indisponivel: boolean
  pg: boolean
  valid_on: string
}

export type OrigemGasto = 'pessoal' | 'lanche'

export interface CategoriaGasto {
  id: number
  origem: OrigemGasto
  nome: string
  ordem: number
  ativo: boolean
  created_at: string
}

export interface Gasto {
  id: number
  valor: number
  data: string            // 'YYYY-MM-DD'
  origem: OrigemGasto
  categoria_id: number
  forma_pagamento: FormaPagamento
  fornecedor?: string
  descricao?: string
  user_id?: string
  created_at: string
  updated_at: string
  categoria?: { nome: string } | null
}
