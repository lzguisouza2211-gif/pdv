import { useEffect, useState } from 'react'
import { ItemCardapio } from '@/types'
import { fetchCardapio, updateProductDisponivel, updateProductPreco } from '@/services/api/cardapio.service'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/utils/calc'
import { ChevronDown } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export function QuickMenuManagement() {
  const [itens, setItens] = useState<ItemCardapio[]>([])
  const [editingPreco, setEditingPreco] = useState<Record<string, string>>({})
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())
  const [toggling, setToggling] = useState<string | null>(null)
  const { toast } = useToast()

  function toggleCat(cat: string) {
    setExpandedCats(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  useEffect(() => {
    fetchCardapio().then(setItens).catch(console.error)
  }, [])

  async function handleToggleDisponivel(id: string, current: boolean) {
    setToggling(id)
    try {
      await updateProductDisponivel(id, !current)
      setItens((prev) =>
        prev.map((i) => (i.id === id ? { ...i, disponivel: !current } : i))
      )
      toast({
        title: !current ? 'Produto disponível' : 'Produto indisponível',
        description: !current ? 'Visível no cardápio' : 'Oculto do cardápio',
      })
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao atualizar produto', variant: 'destructive' })
    } finally {
      setToggling(null)
    }
  }

  async function handleSavePreco(id: string) {
    const raw = editingPreco[id]
    if (!raw) return
    const preco = parseFloat(raw.replace(',', '.'))
    if (isNaN(preco) || preco <= 0) return
    try {
      await updateProductPreco(id, preco)
      setItens((prev) => prev.map((i) => (i.id === id ? { ...i, preco } : i)))
      setEditingPreco((prev) => { const n = { ...prev }; delete n[id]; return n })
      toast({ title: 'Preço atualizado' })
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao atualizar preço', variant: 'destructive' })
    }
  }

  const categorias = [...new Set(itens.map((i) => i.categoria))]

  return (
    <div className="space-y-2">
      {categorias.map((cat) => {
        const open = expandedCats.has(cat)
        return (
        <div key={cat} className="border rounded-lg overflow-hidden">
          <button
            onClick={() => toggleCat(cat)}
            className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/60 transition-colors text-left"
          >
            <h3 className="font-semibold">{cat}</h3>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
          <div className="p-3 space-y-2">
            {itens.filter((i) => i.categoria === cat).map((item) => (
              <div key={item.id} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={item.disponivel}
                    disabled={toggling === item.id}
                    onCheckedChange={() => handleToggleDisponivel(item.id, item.disponivel)}
                  />
                  <span className="flex-1 min-w-0 capitalize text-sm truncate">{item.nome}</span>
                  {editingPreco[item.id] === undefined && (
                    <button
                      className="text-sm text-primary underline hover:no-underline shrink-0"
                      onClick={() =>
                        setEditingPreco((prev) => ({ ...prev, [item.id]: String(item.preco) }))
                      }
                    >
                      {formatBRL(item.preco)}
                    </button>
                  )}
                </div>
                {editingPreco[item.id] !== undefined && (
                  <div className="flex items-center gap-2 pl-9">
                    <Input
                      className="flex-1 min-w-0 h-8 text-sm"
                      value={editingPreco[item.id]}
                      onChange={(e) =>
                        setEditingPreco((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                    />
                    <Button size="sm" className="h-8 shrink-0" onClick={() => handleSavePreco(item.id)}>
                      Salvar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 shrink-0"
                      onClick={() =>
                        setEditingPreco((prev) => { const n = { ...prev }; delete n[item.id]; return n })
                      }
                    >
                      Cancelar
                    </Button>
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
  )
}
