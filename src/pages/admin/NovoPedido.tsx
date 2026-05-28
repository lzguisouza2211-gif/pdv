import { useState, useRef, useEffect } from 'react'
import { useCardapio } from '@/hooks/useCardapio'
import { criarPedido } from '@/services/api/pedidos.service'
import { useToast } from '@/hooks/use-toast'
import { formatBRL } from '@/utils/calc'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ProductCustomizationModal } from '@/components/pdv/ProductCustomizationModal'
import { ItemCardapio, TipoEntrega, PedidoItem, ExtraOption } from '@/types'
import { gerarCartKey } from '@/utils/pedido'
import { Plus, Minus, Trash2, ShoppingBag, UtensilsCrossed, X, ChevronDown } from 'lucide-react'

type CartLine = {
  key: string
  item: ItemCardapio
  qty: number
  extras: ExtraOption[]
  obs: string
}

const CUSTOM_CATS = new Set(['Lanches', 'Macarrão', 'Omeletes'])

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

const TIPOS: { value: TipoEntrega; label: string }[] = [
  { value: 'local', label: 'Mesa / Local' },
  { value: 'retirada', label: 'Retirada' },
]

function calcLineTotal(line: CartLine) {
  const extras = line.extras.filter(e => e.tipo === 'add').reduce((s, e) => s + e.preco * (e.qty ?? 1), 0)
  return (line.item.preco + extras) * line.qty
}

interface NovoPedidoProps {
  defaultCliente?: string
  lockTipoEntrega?: TipoEntrega
  onSuccess?: () => void
}

export function NovoPedido({ defaultCliente, lockTipoEntrega, onSuccess }: NovoPedidoProps = {}) {
  const { itens, loading } = useCardapio()
  const { toast } = useToast()

  const [cart, setCart] = useState<CartLine[]>([])
  const [cliente, setCliente] = useState(defaultCliente ?? '')
  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega>(lockTipoEntrega ?? 'local')
  const [enviando, setEnviando] = useState(false)
  const [busca, setBusca] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())
  const [pendingItem, setPendingItem] = useState<ItemCardapio | null>(null)
  const buscaRef = useRef<HTMLInputElement>(null)

  const itensAtivos = itens.filter(i => i.ativo)
  const categorias = [...new Set(itensAtivos.map(i => i.categoria))]

  useEffect(() => {
    if (categorias.length > 0 && expandedCats.size === 0) {
      setExpandedCats(new Set([categorias[0]]))
    }
  }, [categorias.length]) // eslint-disable-line

  function toggleCat(cat: string) {
    setExpandedCats(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  const itensFiltrados = busca
    ? itensAtivos.filter(i => normalize(i.nome).includes(normalize(busca)))
    : itensAtivos

  function handleClickItem(item: ItemCardapio) {
    if (!item.disponivel) return
    if (CUSTOM_CATS.has(item.categoria)) {
      setPendingItem(item)
    } else {
      addToCart(item, gerarCartKey(item.id, [], ''), [], '')
    }
  }

  function handleCustomConfirm(extras: ExtraOption[], obs: string, qty: number) {
    if (!pendingItem) return
    const key = gerarCartKey(pendingItem.id, extras, obs)
    addToCart(pendingItem, key, extras, obs, qty)
    setPendingItem(null)
  }

  function addToCart(item: ItemCardapio, key: string, extras: ExtraOption[], obs: string, qty = 1) {
    setCart(prev => {
      const existing = prev.find(l => l.key === key)
      if (existing) return prev.map(l => l.key === key ? { ...l, qty: l.qty + qty } : l)
      return [...prev, { key, item, qty, extras, obs }]
    })
  }

  function changeQty(key: string, delta: number) {
    setCart(prev =>
      prev.map(l => l.key === key ? { ...l, qty: l.qty + delta } : l).filter(l => l.qty > 0)
    )
  }

  function removeFromCart(key: string) {
    setCart(prev => prev.filter(l => l.key !== key))
  }

  const total = cart.reduce((s, l) => s + calcLineTotal(l), 0)
  const totalItens = cart.reduce((s, l) => s + l.qty, 0)

  async function handleCriarPedido() {
    if (cart.length === 0) return

    const itensPayload: PedidoItem[] = cart.map(l => {
      const adicionais = l.extras.filter(e => e.tipo === 'add')
      const retirados = l.extras.filter(e => e.tipo === 'remove')
      const precoUnitario = l.item.preco + adicionais.reduce((s, e) => s + e.preco * (e.qty ?? 1), 0)
      return {
        nome: l.item.nome,
        preco: precoUnitario,
        quantidade: l.qty,
        categoria: l.item.categoria,
        observacoes: l.obs || undefined,
        adicionais,
        retirados,
      }
    })

    setEnviando(true)
    try {
      await criarPedido({
        cliente: cliente.trim() || 'Mesa',
        tipoentrega: tipoEntrega,
        itens: itensPayload,
        formapagamento: 'dinheiro',
        taxa_entrega: 0,
        total,
      })

      toast({ title: 'Pedido criado!', description: `${formatBRL(total)} · ${totalItens} item(s)` })
      setCart([])
      setCliente(defaultCliente ?? '')
      setCartOpen(false)
      onSuccess?.()
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao criar pedido', variant: 'destructive' })
    } finally {
      setEnviando(false)
    }
  }

  if (loading) return <p className="text-muted-foreground text-sm">Carregando cardápio…</p>

  // JSX variable (not a component) so React doesn't remount on re-render → inputs keep focus
  const cartPanel = (
    <div className="space-y-4">
      {cart.length === 0 ? (
        <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
          <UtensilsCrossed className="h-10 w-10 opacity-30" />
          <p className="text-sm">Nenhum item adicionado</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {cart.map(l => {
            const adicionais = l.extras.filter(e => e.tipo === 'add')
            const retirados = l.extras.filter(e => e.tipo === 'remove')
            return (
              <div key={l.key} className="py-2 border-b last:border-0">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm leading-tight">{l.item.nome}</p>
                    {adicionais.length > 0 && (
                      <p className="text-xs text-green-600 mt-0.5">
                        + {adicionais.map(a => {
                          const q = a.qty ?? 1
                          return `${q > 1 ? `${q}x ` : ''}${a.nome} (+${formatBRL(a.preco * q)})`
                        }).join(', ')}
                      </p>
                    )}
                    {retirados.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        sem {retirados.map(r => r.nome).join(', ')}
                      </p>
                    )}
                    {l.obs && (
                      <p className="text-xs text-muted-foreground italic mt-0.5">"{l.obs}"</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">{formatBRL(calcLineTotal(l))}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => changeQty(l.key, -1)}
                      className="h-8 w-8 rounded-lg border flex items-center justify-center hover:bg-muted active:scale-90 transition-transform"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{l.qty}</span>
                    <button
                      onClick={() => changeQty(l.key, 1)}
                      className="h-8 w-8 rounded-lg border flex items-center justify-center hover:bg-muted active:scale-90 transition-transform"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => removeFromCart(l.key)}
                      className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-destructive/10 active:scale-90 transition-transform ml-1"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {cart.length > 0 && (
        <div className="flex justify-between font-bold text-base border-t pt-2">
          <span>Total</span>
          <span className="text-primary">{formatBRL(total)}</span>
        </div>
      )}

      {/* Formulário */}
      <div className="space-y-3 border-t pt-3">
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">
            Cliente / Mesa
          </Label>
          <Input
            placeholder="Ex: Mesa 4, João..."
            value={cliente}
            onChange={e => setCliente(e.target.value)}
          />
        </div>

        {!lockTipoEntrega && (
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">
              Tipo
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS.map(t => (
                <button
                  key={t.value}
                  onClick={() => setTipoEntrega(t.value)}
                  className={`py-2.5 rounded-lg border font-medium text-sm transition-colors ${
                    tipoEntrega === t.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'hover:bg-muted'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <Button
        className="w-full h-12 text-base font-semibold"
        disabled={cart.length === 0 || enviando}
        onClick={handleCriarPedido}
      >
        {enviando ? 'Criando…' : cart.length === 0 ? 'Adicione itens' : `Criar Pedido · ${formatBRL(total)}`}
      </Button>
    </div>
  )

  // ── Product card ──────────────────────────────────────────────────────────
  const ProductBtn = ({ item }: { item: ItemCardapio }) => {
    const noCart = cart.filter(l => l.item.id === item.id).reduce((s, l) => s + l.qty, 0)
    const indisponivel = !item.disponivel
    return (
      <button
        onClick={() => handleClickItem(item)}
        disabled={indisponivel}
        className={`relative text-left border rounded-xl p-4 transition-all ${
          indisponivel
            ? 'opacity-50 cursor-not-allowed bg-muted/30'
            : noCart > 0
              ? 'border-primary/50 bg-primary/5 active:scale-95'
              : 'hover:bg-muted/60 hover:border-primary/30 active:scale-95'
        } bg-background`}
      >
        {indisponivel && (
          <Badge variant="destructive" className="absolute top-2 right-2 text-[10px] px-1.5 py-0">
            Indisponível
          </Badge>
        )}
        {!indisponivel && noCart > 0 && (
          <Badge className="absolute top-2 right-2 h-6 w-6 p-0 flex items-center justify-center text-xs rounded-full">
            {noCart}
          </Badge>
        )}
        <p className="text-sm font-semibold leading-tight pr-20">{item.nome}</p>
        <p className="text-sm text-primary font-bold mt-2">{formatBRL(item.preco)}</p>
        {!indisponivel && item.ingredientes_indisponiveis && item.ingredientes_indisponiveis.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {item.ingredientes_indisponiveis.map((ing) => (
              <Badge key={ing} variant="outline" className="text-[10px] px-1.5 py-0 text-destructive border-destructive">
                sem {ing}
              </Badge>
            ))}
          </div>
        )}
        {!indisponivel && CUSTOM_CATS.has(item.categoria) && (
          <p className="text-[10px] text-muted-foreground mt-1">toque para personalizar</p>
        )}
        {!indisponivel && <Plus className="absolute bottom-3 right-3 h-4 w-4 text-muted-foreground/50" />}
      </button>
    )
  }

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-6 pb-28 lg:pb-0">

        {/* Produtos */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xl font-bold shrink-0">Novo Pedido</h2>
            <Input
              ref={buscaRef}
              placeholder="Buscar produto…"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="max-w-xs"
            />
          </div>

          {/* Resultado de busca plano */}
          {busca && (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
              {itensFiltrados.map(item => <ProductBtn key={item.id} item={item} />)}
            </div>
          )}

          {/* Categorias em accordion */}
          {!busca && categorias.map(cat => {
            const lista = itensAtivos.filter(i => i.categoria === cat)
            const open = expandedCats.has(cat)
            const cartCount = cart
              .filter(l => l.item.categoria === cat)
              .reduce((s, l) => s + l.qty, 0)

            return (
              <div key={cat} className="border rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleCat(cat)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <span className="font-semibold text-sm">{cat}</span>
                  <div className="flex items-center gap-2">
                    {cartCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {cartCount} no carrinho
                      </Badge>
                    )}
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {open && (
                  <div className="px-3 pb-3 pt-1 border-t bg-muted/20">
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                      {lista.map(item => <ProductBtn key={item.id} item={item} />)}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Carrinho desktop */}
        <div className="hidden lg:block lg:w-80 shrink-0">
          <Card className="sticky top-24">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 font-semibold mb-4">
                <ShoppingBag className="h-4 w-4" />
                Carrinho
                {totalItens > 0 && <Badge variant="secondary" className="ml-auto">{totalItens}</Badge>}
              </div>
              {cartPanel}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Barra flutuante mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t px-4 py-3">
        <button
          onClick={() => setCartOpen(true)}
          className={`w-full flex items-center justify-between rounded-xl px-5 py-4 font-semibold transition-all ${
            totalItens > 0
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
              : 'bg-muted text-muted-foreground cursor-default'
          }`}
        >
          <span className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            {totalItens === 0 ? 'Carrinho vazio' : `${totalItens} item${totalItens > 1 ? 's' : ''}`}
          </span>
          {total > 0 && <span className="text-base font-bold">{formatBRL(total)}</span>}
        </button>
      </div>

      {/* Bottom sheet mobile */}
      {cartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setCartOpen(false)} />
          <div className="relative bg-background rounded-t-2xl max-h-[88dvh] flex flex-col shadow-2xl">
            <div className="sticky top-0 bg-background rounded-t-2xl border-b px-4 py-3 flex items-center justify-between z-10">
              <div className="flex items-center gap-2 font-semibold">
                <ShoppingBag className="h-4 w-4" />
                Carrinho
                {totalItens > 0 && <Badge variant="secondary">{totalItens}</Badge>}
              </div>
              <button
                onClick={() => setCartOpen(false)}
                className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              {cartPanel}
            </div>
          </div>
        </div>
      )}

      {/* Modal de personalização */}
      <ProductCustomizationModal
        item={pendingItem}
        open={!!pendingItem}
        onClose={() => setPendingItem(null)}
        onConfirm={handleCustomConfirm}
        confirmLabel="Adicionar ao pedido"
      />
    </>
  )
}
