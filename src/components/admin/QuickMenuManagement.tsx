import { useEffect, useState } from 'react'
import { ItemCardapio } from '@/types'
import { fetchCardapio, updateProductDisponivel, updateProductBasic, deleteProduct } from '@/services/api/cardapio.service'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { formatBRL } from '@/utils/calc'
import { ChevronDown, Pencil, Search, X, ChevronsUpDown, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Props {
  reloadSignal?: number
}

export function QuickMenuManagement({ reloadSignal = 0 }: Props) {
  const [itens, setItens] = useState<ItemCardapio[]>([])
  const [editingItem, setEditingItem] = useState<Record<string, { nome: string; preco: string }>>({})
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())
  const [toggling, setToggling] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<ItemCardapio | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  function formatBRLInput(value: string): string {
    const digits = value.replace(/\D/g, '')
    if (!digits) return ''
    const amount = Number(digits) / 100
    return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function formatBRLFromNumber(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  useEffect(() => {
    fetchCardapio()
      .then((data) => {
        setItens(data)
        setExpandedCats(new Set(data.map((i) => i.categoria)))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [reloadSignal])

  function toggleCat(cat: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  const filteredItens = search.trim()
    ? itens.filter((i) => i.nome.toLowerCase().includes(search.toLowerCase()))
    : itens

  const categorias = [...new Set(filteredItens.map((i) => i.categoria))]
  const allExpanded = categorias.every((c) => expandedCats.has(c))

  function toggleAll() {
    setExpandedCats(allExpanded ? new Set() : new Set(categorias))
  }

  async function handleToggleDisponivel(id: string, current: boolean) {
    setToggling(id)
    try {
      await updateProductDisponivel(id, !current)
      setItens((prev) => prev.map((i) => (i.id === id ? { ...i, disponivel: !current } : i)))
      toast({
        title: !current ? 'Produto disponível' : 'Produto indisponível',
        description: !current ? 'Visível no cardápio' : 'Oculto do cardápio',
      })
    } catch {
      toast({ title: 'Erro ao atualizar produto', variant: 'destructive' })
    } finally {
      setToggling(null)
    }
  }

  function startEdit(item: ItemCardapio) {
    setEditingItem((prev) => ({
      ...prev,
      [item.id]: {
        nome: item.nome,
        preco: formatBRLFromNumber(item.preco),
      },
    }))
  }

  async function handleSaveItem(id: string) {
    const current = editingItem[id]
    if (!current) return

    const nome = current.nome.trim()
    const preco = Number(current.preco.replace(/\D/g, '')) / 100
    if (!nome || Number.isNaN(preco) || preco <= 0) {
      toast({
        title: 'Dados inválidos',
        description: 'Informe nome e preço válidos.',
        variant: 'destructive',
      })
      return
    }

    try {
      await updateProductBasic(id, { nome, preco })
      setItens((prev) => prev.map((i) => (i.id === id ? { ...i, nome, preco } : i)))
      setEditingItem((prev) => { const n = { ...prev }; delete n[id]; return n })
      toast({ title: 'Produto atualizado' })
    } catch {
      toast({ title: 'Erro ao atualizar produto', variant: 'destructive' })
    }
  }

  function cancelEdit(id: string) {
    setEditingItem((prev) => { const n = { ...prev }; delete n[id]; return n })
  }

  function requestDelete(item: ItemCardapio) {
    setDeleteCandidate(item)
  }

  async function handleDeleteConfirm() {
    if (!deleteCandidate) return

    setDeleting(deleteCandidate.id)
    try {
      await deleteProduct(deleteCandidate.id)
      setItens((prev) => prev.filter((i) => i.id !== deleteCandidate.id))
      setEditingItem((prev) => {
        const n = { ...prev }
        delete n[deleteCandidate.id]
        return n
      })
      toast({ title: 'Produto excluído com sucesso' })
      setDeleteCandidate(null)
    } catch {
      toast({ title: 'Erro ao excluir produto', variant: 'destructive' })
    } finally {
      setDeleting(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <>
    <div className="space-y-4">
      {/* Barra de busca + toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar produto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={toggleAll} className="shrink-0 gap-1.5">
          <ChevronsUpDown className="h-4 w-4" />
          {allExpanded ? 'Recolher' : 'Expandir'}
        </Button>
      </div>

      {/* Categorias */}
      {categorias.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum produto encontrado.</p>
      ) : (
        <div className="space-y-3">
          {categorias.map((cat) => {
            const catItens = filteredItens.filter((i) => i.categoria === cat)
            const disponiveis = catItens.filter((i) => i.disponivel).length
            const open = expandedCats.has(cat)

            return (
              <div key={cat} className="border rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleCat(cat)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{cat}</span>
                    <Badge variant={disponiveis === catItens.length ? 'outline' : 'secondary'} className="text-xs font-normal">
                      {disponiveis}/{catItens.length} disponíveis
                    </Badge>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                </button>

                {open && (
                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                    {catItens.map((item) => (
                      <div
                        key={item.id}
                        className={`rounded-xl border p-3 flex flex-col gap-2.5 transition-all ${
                          item.disponivel
                            ? 'bg-card'
                            : 'bg-muted/30 border-dashed opacity-60'
                        }`}
                      >
                        {/* Nome + switch */}
                        <div className="flex items-start gap-2">
                          {editingItem[item.id] !== undefined ? (
                            <Input
                              className="h-8 text-sm flex-1 min-w-0"
                              value={editingItem[item.id].nome}
                              onChange={(e) =>
                                setEditingItem((prev) => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], nome: e.target.value },
                                }))
                              }
                            />
                          ) : (
                            <p className={`flex-1 min-w-0 text-sm font-semibold leading-snug capitalize ${!item.disponivel ? 'line-through text-muted-foreground' : ''}`}>
                              {item.nome}
                            </p>
                          )}
                          <Switch
                            checked={item.disponivel}
                            disabled={toggling === item.id}
                            onCheckedChange={() => handleToggleDisponivel(item.id, item.disponivel)}
                            className="shrink-0 mt-0.5"
                          />
                        </div>

                        {/* Preço */}
                        {editingItem[item.id] !== undefined ? (
                          <div className="flex items-center gap-1.5">
                            <Input
                              className="h-7 text-xs flex-1 min-w-0"
                              value={editingItem[item.id].preco}
                              inputMode="numeric"
                              onChange={(e) =>
                                setEditingItem((prev) => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], preco: formatBRLInput(e.target.value) },
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveItem(item.id)
                                if (e.key === 'Escape') cancelEdit(item.id)
                              }}
                            />
                            <Button size="sm" className="h-7 px-2 text-xs shrink-0" onClick={() => handleSaveItem(item.id)}>
                              OK
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs shrink-0" onClick={() => cancelEdit(item.id)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-primary">{formatBRL(item.preco)}</span>
                            <div className="flex items-center gap-1">
                              <button
                                className="h-7 w-7 rounded border flex items-center justify-center hover:bg-muted"
                                onClick={() => startEdit(item)}
                                aria-label={`Editar ${item.nome}`}
                              >
                                <Pencil className="h-3.5 w-3.5 opacity-70" />
                              </button>
                              <button
                                className="h-7 w-7 rounded border border-destructive/40 text-destructive flex items-center justify-center hover:bg-destructive/10"
                                onClick={() => requestDelete(item)}
                                disabled={deleting === item.id}
                                aria-label={`Excluir ${item.nome}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
    <Dialog
      open={!!deleteCandidate}
      onOpenChange={(open) => {
        if (!open && deleting === null) setDeleteCandidate(null)
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-destructive">Excluir produto?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {deleteCandidate ? `O item "${deleteCandidate.nome}" será removido definitivamente do banco.` : ''}
        </p>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setDeleteCandidate(null)}
            disabled={deleting !== null}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteConfirm}
            disabled={deleting !== null}
          >
            {deleting !== null ? 'Excluindo...' : 'Excluir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
