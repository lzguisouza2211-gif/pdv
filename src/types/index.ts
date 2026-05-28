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
}

export type Adicional = {
  id: string
  product_id: string
  nome: string
  preco: number
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
