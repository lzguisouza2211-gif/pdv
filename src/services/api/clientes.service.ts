import { supabase } from '@/services/supabaseClient'
import { Cliente, TipoEntrega } from '@/types'

const SESSION_KEY = 'pdv_cliente'

export interface ClienteSession {
  phone: string
  nome: string
  tipoentrega?: TipoEntrega
  endereco?: string
  numero?: string
  bairro?: string
}

export function saveClienteSession(phone: string, nome: string): void {
  try {
    const existing = getClienteSession()
    const session: ClienteSession = { ...existing, phone, nome }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // localStorage pode estar bloqueado (modo privado com storage cheio)
  }
}

export function saveEnderecoSession(
  tipoentrega: TipoEntrega,
  endereco: string,
  numero: string,
  bairro: string
): void {
  try {
    const existing = getClienteSession()
    if (!existing) return
    const session: ClienteSession = { ...existing, tipoentrega, endereco, numero, bairro }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // ignorar
  }
}

export function getClienteSession(): ClienteSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ClienteSession
  } catch {
    return null
  }
}

export function hasSkippedPrompt(): boolean {
  try {
    return sessionStorage.getItem('pdv_prompt_skipped') === '1'
  } catch {
    return false
  }
}

export function markPromptSkipped(): void {
  try {
    sessionStorage.setItem('pdv_prompt_skipped', '1')
  } catch {
    // ignorar
  }
}

export async function buscarClientePorTelefone(phone: string): Promise<Cliente | null> {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('phone', phone)
    .maybeSingle()

  if (error) throw error
  return data as Cliente | null
}

export async function criarCliente(
  nome: string,
  phone: string,
  address?: { tipoentrega?: TipoEntrega; endereco?: string; numero?: string; bairro?: string }
): Promise<Cliente> {
  const { data, error } = await supabase
    .from('clientes')
    .upsert({ nome, phone, ...address }, { onConflict: 'phone', ignoreDuplicates: false })
    .select('*')
    .single()

  if (error) throw error
  return data as Cliente
}

export async function atualizarEnderecoCliente(
  clienteId: number,
  tipoentrega: TipoEntrega,
  endereco: string,
  numero: string,
  bairro: string
): Promise<void> {
  const { error } = await supabase
    .from('clientes')
    .update({ tipoentrega, endereco, numero, bairro })
    .eq('id', clienteId)
  if (error) throw error
}

export async function registrarPedidoNoCliente(clienteId: number, valor: number): Promise<void> {
  const { error } = await supabase.rpc('fn_registrar_pedido_cliente', {
    p_cliente_id: clienteId,
    p_valor: valor,
  })
  if (error) throw error
}

export async function vincularClienteAoPedido(pedidoId: number | string, clienteId: number): Promise<void> {
  const { error } = await supabase
    .from('pedidos')
    .update({ cliente_id: clienteId })
    .eq('id', pedidoId)
  if (error) throw error
}

export async function listarClientes(opts?: {
  page?: number
  perPage?: number
  search?: string
}): Promise<{ data: Cliente[]; count: number }> {
  const page = opts?.page ?? 1
  const perPage = opts?.perPage ?? 20
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  let query = supabase
    .from('clientes')
    .select('*', { count: 'exact' })
    .order('ultima_compra', { ascending: false, nullsFirst: false })
    .range(from, to)

  if (opts?.search) {
    query = query.or(`nome.ilike.%${opts.search}%,phone.ilike.%${opts.search}%`)
  }

  const { data, error, count } = await query
  if (error) throw error
  return { data: (data ?? []) as Cliente[], count: count ?? 0 }
}
