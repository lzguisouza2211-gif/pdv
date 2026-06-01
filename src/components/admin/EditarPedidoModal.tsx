import { useState, useEffect } from 'react'
import { Pedido, PedidoStatus, FormaPagamento, PedidoItem, ItemCardapio, ExtraOption } from '@/types'
import { editarPedido, cancelarPedido } from '@/services/api/pedidos.service'
import { notificarStatusPedido } from '@/services/whatsapp.service'
import { useCardapio } from '@/hooks/useCardapio'
import { useToast } from '@/hooks/use-toast'
import { formatBRL } from '@/utils/calc'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Minus, Trash2, ChevronDown } from 'lucide-react'
import { ProductCustomizationModal } from '@/components/pdv/ProductCustomizationModal'

const CUSTOM_CATS = new Set(['Lanches', 'Macarrão', 'Omeletes'])

const FORMAS: { value: FormaPagamento; label: string }[] = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'cartao', label: 'Cartão' },
]

const STATUSES: PedidoStatus[] = ['Recebido', 'Em preparo', 'Finalizado']

interface Props {
  pedido: Pedido | null
  onClose: () => void
  onSaved: () => void
}

export function EditarPedidoModal({ pedido, onClose, onSaved }: Props) {
  const { itens: cardapio } = useCardapio()
  const { toast } = useToast()

  const [editItems, setEditItems] = useState<PedidoItem[]>([])
  const [cliente, setCliente] = useState('')
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('dinheiro')
  const [status, setStatus] = useState<PedidoStatus>('Recebido')
  const [salvando, setSalvando] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [buscaAdd, setBuscaAdd] = useState('')
  const [adicionando, setAdicionando] = useState(false)
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())
  const [pendingAddItem, setPendingAddItem] = useState<ItemCardapio | null>(null)

  useEffect(() => {
    if (!pedido) return
    setEditItems([...pedido.itens])
    setCliente(pedido.cliente)
    setFormaPagamento(pedido.formapagamento)
    setStatus(pedido.status === 'Cancelado' ? 'Recebido' : pedido.status)
    setConfirmCancel(false)
    setAdicionando(false)
    setBuscaAdd('')
    setExpandedCats(new Set())
  }, [pedido])

  const total = editItems.reduce((s, i) => s + i.preco * i.quantidade, 0)

  function changeQty(index: number, delta: number) {
    setEditItems(prev =>
      prev
        .map((it, i) => i === index ? { ...it, quantidade: it.quantidade + delta } : it)
        .filter(it => it.quantidade > 0)
    )
  }

  function removeItem(index: number) {
    setEditItems(prev => prev.filter((_, i) => i !== index))
  }

  function handleClickFromCardapio(item: ItemCardapio) {
    if (CUSTOM_CATS.has(item.categoria)) {
      setPendingAddItem(item)
    } else {
      addFromCardapio(item, [], '')
    }
  }

  function addFromCardapio(item: ItemCardapio, extras: ExtraOption[], obs: string) {
    const adicionais = extras.filter(e => e.tipo === 'add')
    const retirados = extras.filter(e => e.tipo === 'remove')
    const precoFinal = item.preco + adicionais.reduce((s, e) => s + e.preco * (e.qty ?? 1), 0)

    setEditItems(prev => {
      if (adicionais.length > 0 || retirados.length > 0 || obs) {
        return [...prev, {
          nome: item.nome,
          preco: precoFinal,
          quantidade: 1,
          categoria: item.categoria,
          observacoes: obs || undefined,
          adicionais,
          retirados,
        }]
      }
      const idx = prev.findIndex(i => i.nome === item.nome && i.adicionais.length === 0)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], quantidade: next[idx].quantidade + 1 }
        return next
      }
      return [...prev, {
        nome: item.nome,
        preco: item.preco,
        quantidade: 1,
        categoria: item.categoria,
        adicionais: [],
        retirados: [],
      }]
    })
  }

  const categorias = [...new Set(
    cardapio.filter(i => i.ativo && i.disponivel).map(i => i.categoria)
  )]

  const produtosFiltrados = cardapio
    .filter(i => i.ativo && i.disponivel)
    .filter(i => !buscaAdd || i.nome.toLowerCase().includes(buscaAdd.toLowerCase()))

  function toggleCat(cat: string) {
    setExpandedCats(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  async function handleSalvar() {
    if (!pedido || editItems.length === 0) return
    setSalvando(true)
    try {
      await editarPedido(pedido.id, {
        cliente: cliente.trim() || pedido.cliente,
        formapagamento: formaPagamento,
        status,
        itens: editItems,
        total,
      })
      toast({ title: 'Pedido atualizado' })
      if (status !== pedido.status) {
        const wppStatus =
          status === 'Em preparo' ? 'preparing'
          : status === 'Finalizado'
            ? (pedido.tipoentrega === 'entrega' ? 'out_for_delivery' : 'ready_for_pickup')
            : null
        if (wppStatus) {
          void notificarStatusPedido({
            phone: pedido.phone,
            customerName: pedido.cliente,
            orderId: String(pedido.id),
            status: wppStatus,
            total,
          })
        }
      }
      onSaved()
      onClose()
    } catch (err) {
      toast({ title: 'Erro ao salvar', variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  async function handleCancelar() {
    if (!pedido) return
    setCancelando(true)
    try {
      await cancelarPedido(pedido)
      toast({
        title: 'Pedido cancelado',
        description: pedido.phone ? 'Cliente notificado via WhatsApp' : undefined,
      })
      void notificarStatusPedido({
        phone: pedido.phone,
        customerName: pedido.cliente,
        orderId: String(pedido.id),
        status: 'cancelled',
        total: pedido.total,
      })
      setConfirmCancel(false)
      onSaved()
      onClose()
    } catch (err) {
      toast({ title: 'Erro ao cancelar pedido', variant: 'destructive' })
    } finally {
      setCancelando(false)
    }
  }

  return (
    <>
    <Dialog open={!!pedido && !confirmCancel} onOpenChange={(open) => { if (!open && !confirmCancel) { onClose() } }}>
      <DialogContent className="max-w-lg max-h-[90dvh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>Editar Pedido #{pedido?.id}</DialogTitle>
        </DialogHeader>

        {/* Conteúdo rolável */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">

          {/* Cliente */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">
              Cliente / Mesa
            </Label>
            <Input value={cliente} onChange={e => setCliente(e.target.value)} />
          </div>

          {/* Itens */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 block">
              Itens
            </Label>

            {editItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nenhum item. Adicione abaixo.</p>
            ) : (
              <div className="space-y-1 mb-3">
                {editItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 py-2 border-b last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.nome}</p>
                      <p className="text-xs text-muted-foreground">{formatBRL(item.preco * item.quantidade)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => changeQty(idx, -1)}
                        className="h-7 w-7 rounded border flex items-center justify-center hover:bg-muted"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-sm font-bold">{item.quantidade}</span>
                      <button
                        onClick={() => changeQty(idx, 1)}
                        className="h-7 w-7 rounded border flex items-center justify-center hover:bg-muted"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => removeItem(idx)}
                        className="h-7 w-7 rounded flex items-center justify-center hover:bg-destructive/10 ml-1"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Adicionar item */}
            <button
              onClick={() => setAdicionando(v => !v)}
              className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
            >
              <Plus className="h-4 w-4" />
              {adicionando ? 'Fechar seletor' : 'Adicionar item'}
            </button>

            {adicionando && (
              <div className="mt-3 border rounded-lg overflow-hidden">
                <div className="px-3 pt-3 pb-2">
                  <Input
                    placeholder="Buscar produto…"
                    value={buscaAdd}
                    onChange={e => setBuscaAdd(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                  />
                </div>

                <div className="max-h-56 overflow-y-auto">
                  {buscaAdd ? (
                    // Resultados de busca planos
                    produtosFiltrados.length === 0 ? (
                      <p className="text-sm text-muted-foreground px-3 py-3">Nenhum resultado</p>
                    ) : (
                      <div className="p-2 space-y-1">
                        {produtosFiltrados.map(item => (
                          <button
                            key={item.id}
                            onClick={() => handleClickFromCardapio(item)}
                            className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-muted text-sm text-left"
                          >
                            <span className="font-medium">{item.nome}</span>
                            <span className="text-primary font-semibold shrink-0 ml-2">{formatBRL(item.preco)}</span>
                          </button>
                        ))}
                      </div>
                    )
                  ) : (
                    // Agrupado por categoria
                    categorias.map(cat => {
                      const lista = cardapio.filter(i => i.ativo && i.disponivel && i.categoria === cat)
                      const open = expandedCats.has(cat)
                      return (
                        <div key={cat} className="border-t first:border-t-0">
                          <button
                            onClick={() => toggleCat(cat)}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/60 text-sm font-semibold text-left"
                          >
                            {cat}
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
                          </button>
                          {open && (
                            <div className="pb-1 space-y-0.5">
                              {lista.map(item => (
                                <button
                                  key={item.id}
                                  onClick={() => handleClickFromCardapio(item)}
                                  className="w-full flex items-center justify-between px-4 py-1.5 hover:bg-muted text-sm text-left"
                                >
                                  <span>{item.nome}</span>
                                  <span className="text-primary font-semibold shrink-0 ml-2">{formatBRL(item.preco)}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Pagamento */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">
              Forma de pagamento
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {FORMAS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setFormaPagamento(f.value)}
                  className={`py-2.5 rounded-lg border font-medium text-sm transition-colors ${
                    formaPagamento === f.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'hover:bg-muted'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">
              Status
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`py-2 rounded-lg border text-xs font-medium transition-colors ${
                    status === s
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'hover:bg-muted'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="flex justify-between items-center border-t pt-3 font-bold">
            <span>Total</span>
            <span className="text-primary text-lg">{formatBRL(total)}</span>
          </div>

        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <div className="flex items-center justify-between w-full gap-2">
            <Button
              variant="outline"
              className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmCancel(true)}
            >
              Cancelar Pedido
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Fechar</Button>
              <Button onClick={handleSalvar} disabled={salvando || editItems.length === 0}>
                {salvando ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={confirmCancel} onOpenChange={(open) => { if (!open) setConfirmCancel(false) }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-destructive">Cancelar Pedido #{pedido?.id}?</DialogTitle>
        </DialogHeader>
        <div className="py-1 space-y-1">
          <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita.</p>
          {pedido?.phone && (
            <p className="text-sm text-muted-foreground">O cliente será notificado via WhatsApp.</p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setConfirmCancel(false)}>
            Não, voltar
          </Button>
          <Button variant="destructive" onClick={handleCancelar} disabled={cancelando}>
            {cancelando ? 'Cancelando…' : 'Sim, cancelar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <ProductCustomizationModal
      item={pendingAddItem}
      open={!!pendingAddItem}
      onClose={() => setPendingAddItem(null)}
      onConfirm={(extras, obs) => {
        if (pendingAddItem) addFromCardapio(pendingAddItem, extras, obs)
        setPendingAddItem(null)
      }}
      confirmLabel="Adicionar ao pedido"
    />
    </>
  )
}
