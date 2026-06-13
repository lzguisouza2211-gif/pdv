import { useEffect, useRef, useState } from 'react'
import { useCart, useCartSubtotal } from '@/store/useCart'
import { TipoEntrega, FormaPagamento, CartItem, ExtraOption, ItemCardapio, Cliente } from '@/types'
import { normalizePedidoPayload, gerarCartKey } from '@/utils/pedido'
import { validarTelefoneBrasileiro, formatarTelefone } from '@/utils/validation'
import { formatBRL, calcTotal, calcTroco, calcItemPrice } from '@/utils/calc'
import { criarPedido } from '@/services/api/pedidos.service'
import { notificarStatusPedido } from '@/services/whatsapp.service'
import {
  buscarClientePorTelefone, saveClienteSession, saveEnderecoSession, getClienteSession,
} from '@/services/api/clientes.service'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { PixKeyDisplay } from './PixKeyDisplay'
import { ProductCustomizationModal } from './ProductCustomizationModal'
import { X, Minus, Plus, Pencil, Trash2 } from 'lucide-react'

const CUSTOM_CATS = new Set(['Lanches', 'Macarrão', 'Omeletes'])

export interface CheckoutSuccess {
  nome: string
  phone: string
  total: number
  pedidoId: string
  clienteEncontrado: Cliente | null
  tipoentrega: TipoEntrega
  endereco: string
  numero: string
  bairro: string
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: (result: CheckoutSuccess) => void
  deliveryFee: number
}

const TIPO_LABEL: Record<TipoEntrega, string> = {
  retirada: 'Retirada',
  entrega: 'Entrega',
  local: 'Mesa',
}

const PG_LABEL: Record<FormaPagamento, string> = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  pix: 'Pix',
}

export function CartDrawer({ open, onClose, onSuccess, deliveryFee }: Props) {
  const { items, remove, removeAll, updateQty, add, clear } = useCart()
  const [editingItem, setEditingItem] = useState<CartItem | null>(null)
  const subtotal = useCartSubtotal()

  const [cliente, setCliente] = useState('')
  const [phone, setPhone] = useState('')
  const [tipoentrega, setTipoentrega] = useState<TipoEntrega>('retirada')
  const [endereco, setEndereco] = useState('')
  const [numero, setNumero] = useState('')
  const [bairro, setBairro] = useState('')
  const [formapagamento, setFormapagamento] = useState<FormaPagamento>('dinheiro')
  const [valorPago, setValorPago] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [clienteEncontrado, setClienteEncontrado] = useState<Cliente | null>(null)
  const submitting = useRef(false)
  const phoneRef = useRef(phone)
  useEffect(() => { phoneRef.current = phone }, [phone])

  // Bloqueia scroll do fundo quando o sheet está aberto (mobile)
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (!open || phoneRef.current) return
    const session = getClienteSession()
    if (!session?.phone) return
    setPhone(session.phone)
    if (session.nome) setCliente(session.nome)
    if (session.tipoentrega) setTipoentrega(session.tipoentrega)
    if (session.endereco) setEndereco(session.endereco)
    if (session.numero) setNumero(session.numero)
    if (session.bairro) setBairro(session.bairro)
    buscarClientePorTelefone(session.phone)
      .then((found) => {
        if (!found) return
        setClienteEncontrado(found)
        setCliente(found.nome)
        if (found.tipoentrega) setTipoentrega(found.tipoentrega)
        if (found.endereco) setEndereco(found.endereco)
        if (found.numero) setNumero(found.numero)
        if (found.bairro) setBairro(found.bairro)
        saveClienteSession(session.phone, found.nome)
      })
      .catch(() => {})
  }, [open])

  async function handlePhoneBlur() {
    if (!validarTelefoneBrasileiro(phone)) return
    try {
      const found = await buscarClientePorTelefone(phone)
      if (found) {
        setClienteEncontrado(found)
        if (!cliente.trim()) setCliente(found.nome)
        if (found.tipoentrega) setTipoentrega(found.tipoentrega)
        if (found.endereco) setEndereco(found.endereco)
        if (found.numero) setNumero(found.numero)
        if (found.bairro) setBairro(found.bairro)
        saveClienteSession(phone, found.nome)
      } else {
        setClienteEncontrado(null)
      }
    } catch (err) {
    }
  }

  const taxa = tipoentrega === 'entrega' ? deliveryFee : 0
  const total = calcTotal(subtotal, taxa)
  const troco =
    formapagamento === 'dinheiro' && valorPago
      ? calcTroco(parseFloat(valorPago.replace(',', '.')), total)
      : null

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!cliente.trim()) errs.cliente = 'Nome obrigatório'
    if (!validarTelefoneBrasileiro(phone)) errs.phone = 'Telefone inválido'
    if (items.length === 0) errs.cart = 'Carrinho vazio'
    if (tipoentrega === 'entrega') {
      if (!endereco.trim()) errs.endereco = 'Rua obrigatória'
      if (!numero.trim()) errs.numero = 'Número obrigatório'
      if (!bairro.trim()) errs.bairro = 'Bairro obrigatório'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    if (submitting.current || loading) return
    if (!validate()) return
    submitting.current = true
    setLoading(true)

    try {
      const itens = normalizePedidoPayload(items)
      const trocoVal =
        formapagamento === 'dinheiro' && valorPago
          ? calcTroco(parseFloat(valorPago.replace(',', '.')), total)
          : undefined

      const pedidoId = await criarPedido({
        cliente: cliente.trim(),
        phone,
        tipoentrega,
        endereco: tipoentrega === 'entrega' ? endereco : undefined,
        numero: tipoentrega === 'entrega' ? numero : undefined,
        bairro: tipoentrega === 'entrega' ? bairro : undefined,
        itens,
        formapagamento,
        troco: trocoVal,
        taxa_entrega: taxa,
        total,
      })

      // Envia confirmação via WhatsApp — fire-and-forget, não bloqueia o checkout
      if (phone) {
        void notificarStatusPedido({
          phone,
          customerName: cliente.trim().split(' ')[0],
          orderId: pedidoId,
          status: 'confirmed',
          total,
          items: items.map((i) => `${i.qty}x ${i.name}`),
        })
      }

      const nome = cliente.trim()
      const phoneSnapshot = phone
      const totalSnapshot = total
      const clienteSnapshot = clienteEncontrado
      const enderecoSnapshot = { tipoentrega, endereco, numero, bairro }
      const addressData = tipoentrega === 'entrega' && endereco.trim()
        ? { tipoentrega, endereco, numero, bairro }
        : undefined

      clear()
      setCliente('')
      setPhone('')
      setEndereco('')
      setNumero('')
      setBairro('')
      setValorPago('')
      setTipoentrega('retirada')
      setFormapagamento('dinheiro')
      setClienteEncontrado(null)
      onClose()
      onSuccess({
        nome,
        phone: phoneSnapshot,
        total: totalSnapshot,
        pedidoId,
        clienteEncontrado: clienteSnapshot,
        ...enderecoSnapshot,
      })

      // Salva sessão local para pré-preencher no próximo pedido
      // (o banco já cuida do cliente via trigger trg_pedido_registrar_cliente)
      saveClienteSession(phoneSnapshot, nome)
      if (addressData) {
        saveEnderecoSession(addressData.tipoentrega, addressData.endereco, addressData.numero, addressData.bairro)
      }
      if ((window as any).CopaFX) {
        ;(window as any).CopaFX.fireworks()
        setTimeout(() => { if ((window as any).CopaFX) (window as any).CopaFX.goal('É CAMPEÃO!') }, 700)
      }
    } catch (err: unknown) {
      const e = err as Record<string, unknown>
      setErrors({ submit: `Erro: ${e?.message ?? 'Tente novamente.'}` })
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  function handleEditConfirm(extras: ExtraOption[], observacoes: string, qty: number) {
    if (!editingItem) return
    removeAll(editingItem.cartKey)
    const newCartKey = gerarCartKey(editingItem.id, extras, observacoes)
    add({
      cartKey: newCartKey,
      id: editingItem.id,
      name: editingItem.name,
      price: editingItem.price,
      qty,
      categoria: editingItem.categoria,
      observacoes,
      extras,
    })
    setEditingItem(null)
  }

  const editingAsCardapio: ItemCardapio | null = editingItem
    ? {
        id: editingItem.id,
        nome: editingItem.name,
        preco: editingItem.price,
        categoria: editingItem.categoria ?? '',
        ativo: true,
        disponivel: true,
        ingredientes: [],
        ingredientes_indisponiveis: [],
        proibeGratuidade: false,
      }
    : null

  if (!open) return null

  return (
    <>
      <div className="drawer-overlay fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      <div className="sheet-bottom fixed bottom-0 left-0 right-0 z-50 max-h-[92vh] rounded-t-3xl bg-background shadow-2xl flex flex-col">
        {/* Grab handle + header */}
        <div className="flex-shrink-0">
          <div style={{ width: 40, height: 5, borderRadius: 999, background: '#E0E2E7', margin: '10px auto 0' }} />
          <div className="flex items-center justify-between px-5 py-3">
            <div>
              <h2 style={{ fontWeight: 800, fontSize: 20, color: '#16202E' }}>Sua sacola</h2>
              {items.length > 0 && (
                <p style={{ color: '#6B7280', fontSize: 13, marginTop: 2 }}>
                  {items.reduce((s, i) => s + i.qty, 0)} item(s) · {formatBRL(subtotal)}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                border: 'none', background: '#F6F6F8', width: 32, height: 32,
                borderRadius: 999, cursor: 'pointer', color: '#6B7280',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ overscrollBehavior: 'contain' }}>
          {/* Items */}
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.3 }}>
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="3" y1="6" x2="21" y2="6" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"/>
                <path d="M16 10a4 4 0 01-8 0" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="font-medium">Carrinho vazio</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.cartKey} className="bg-card border-2 rounded-2xl p-3.5 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold capitalize text-sm leading-tight">{item.name}</p>
                        {item.extras.filter((e) => e.tipo === 'add').map((e) => (
                          <p key={e.nome} className="text-xs text-primary mt-0.5">
                            ➕ {(e.qty ?? 1) > 1 ? `${e.qty}x ` : ''}{e.nome}
                            {e.preco > 0 && ` (+${formatBRL(e.preco * (e.qty ?? 1))})`}
                          </p>
                        ))}
                        {item.extras.filter((e) => e.tipo === 'remove').map((e) => (
                          <p key={e.nome} className="text-xs text-muted-foreground">❌ sem {e.nome}</p>
                        ))}
                        {item.observacoes && (
                          <p className="text-xs italic text-muted-foreground mt-0.5">📝 {item.observacoes}</p>
                        )}
                      </div>
                      <p className="text-sm font-extrabold text-primary shrink-0">
                        {formatBRL(calcItemPrice(item) * item.qty)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                      {/* Qty stepper */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => remove(item.cartKey)}
                          className="h-8 w-8 rounded-full border-2 flex items-center justify-center hover:bg-muted transition-colors"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center font-bold tabular-nums">{item.qty}</span>
                        <button
                          onClick={() => updateQty(item.cartKey, item.qty + 1)}
                          className="h-8 w-8 rounded-full border-2 border-primary flex items-center justify-center hover:bg-primary/10 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5 text-primary" />
                        </button>
                      </div>

                      <div className="ml-auto flex items-center gap-2">
                        {CUSTOM_CATS.has(item.categoria ?? '') && (
                          <button
                            onClick={() => setEditingItem(item)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </button>
                        )}
                        <button
                          onClick={() => removeAll(item.cartKey)}
                          className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/70 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Resumo */}
              <div className="bg-primary/5 border-2 border-primary/20 rounded-2xl p-4 space-y-2">
                {tipoentrega === 'entrega' && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">{formatBRL(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Taxa de entrega</span>
                      <span className="font-medium">{formatBRL(taxa)}</span>
                    </div>
                    <Separator className="my-1" />
                  </>
                )}
                <div className="flex justify-between font-extrabold text-base">
                  <span>Total</span>
                  <span className="text-primary">{formatBRL(total)}</span>
                </div>
              </div>
            </>
          )}

          {/* Formulário */}
          <div className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="cliente" className="text-sm font-semibold">Nome *</Label>
                <Input
                  id="cliente"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  placeholder="Seu nome"
                  className={`mt-1 rounded-xl ${errors.cliente ? 'border-destructive' : ''}`}
                />
                {errors.cliente && <p className="text-xs text-destructive mt-1">{errors.cliente}</p>}
              </div>

              <div>
                <Label htmlFor="phone" className="text-sm font-semibold">Telefone *</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(formatarTelefone(e.target.value))}
                  onBlur={handlePhoneBlur}
                  placeholder="(11) 99999-9999"
                  className={`mt-1 rounded-xl ${errors.phone ? 'border-destructive' : ''}`}
                />
                {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
                {clienteEncontrado && (
                  <p className="text-xs text-primary mt-1 font-medium">✓ Cliente encontrado: {clienteEncontrado.nome}</p>
                )}
              </div>
            </div>

            {/* Tipo de entrega */}
            <div>
              <p className="text-sm font-semibold mb-2">Tipo de entrega</p>
              <div className="flex gap-2">
                {(['retirada', 'entrega', 'local'] as TipoEntrega[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTipoentrega(t)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                      tipoentrega === t
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {TIPO_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>

            {tipoentrega === 'entrega' && (
              <div className="space-y-2">
                <div>
                  <Label htmlFor="endereco" className="text-sm font-semibold">Rua *</Label>
                  <Input
                    id="endereco"
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    placeholder="Nome da rua"
                    className={`mt-1 rounded-xl ${errors.endereco ? 'border-destructive' : ''}`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="numero" className="text-sm font-semibold">Número *</Label>
                    <Input
                      id="numero"
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      placeholder="123"
                      className={`mt-1 rounded-xl ${errors.numero ? 'border-destructive' : ''}`}
                    />
                  </div>
                  <div>
                    <Label htmlFor="bairro" className="text-sm font-semibold">Bairro *</Label>
                    <Input
                      id="bairro"
                      value={bairro}
                      onChange={(e) => setBairro(e.target.value)}
                      placeholder="Bairro"
                      className={`mt-1 rounded-xl ${errors.bairro ? 'border-destructive' : ''}`}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Forma de pagamento */}
            <div>
              <p className="text-sm font-semibold mb-2">Forma de pagamento</p>
              <div className="flex gap-2">
                {(['dinheiro', 'cartao', 'pix'] as FormaPagamento[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormapagamento(f)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                      formapagamento === f
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {PG_LABEL[f]}
                  </button>
                ))}
              </div>
            </div>

            {formapagamento === 'dinheiro' && (
              <div>
                <Label htmlFor="troco" className="text-sm font-semibold">Troco para R$ (opcional)</Label>
                <Input
                  id="troco"
                  type="number"
                  min={total}
                  step="0.01"
                  value={valorPago}
                  onChange={(e) => setValorPago(e.target.value)}
                  placeholder={formatBRL(total)}
                  className="mt-1 rounded-xl"
                />
                {troco !== null && troco >= 0 && (
                  <p className="text-sm mt-1 text-muted-foreground">
                    Troco: <span className="font-bold text-foreground">{formatBRL(troco)}</span>
                  </p>
                )}
              </div>
            )}

            {formapagamento === 'pix' && <PixKeyDisplay total={total} />}

            {(errors.submit || errors.cart) && (
              <p className="text-sm text-destructive font-medium">{errors.submit ?? errors.cart}</p>
            )}
          </div>
        </div>

        {/* Botão de confirmação */}
        <div className="px-4 py-4 border-t flex-shrink-0">
          <button
            onClick={handleSubmit}
            disabled={loading || items.length === 0}
            className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-bold text-base shadow-lg flex items-center justify-between px-5 disabled:opacity-60 active:scale-[0.98] transition-all"
          >
            <span>{loading ? 'Enviando…' : 'Confirmar Pedido'}</span>
            <span className="bg-primary-foreground/20 px-3 py-1 rounded-full text-sm font-extrabold">
              {formatBRL(total)}
            </span>
          </button>
        </div>
      </div>

      <ProductCustomizationModal
        item={editingAsCardapio}
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        onConfirm={handleEditConfirm}
        initialAddQtys={Object.fromEntries(
          editingItem?.extras.filter((e) => e.tipo === 'add').map((e) => [e.nome, e.qty ?? 1]) ?? []
        )}
        initialSelectedRem={new Set(editingItem?.extras.filter((e) => e.tipo === 'remove').map((e) => e.nome))}
        initialObservacoes={editingItem?.observacoes ?? ''}
        initialQty={editingItem?.qty ?? 1}
        confirmLabel="Salvar alterações"
      />
    </>
  )
}
