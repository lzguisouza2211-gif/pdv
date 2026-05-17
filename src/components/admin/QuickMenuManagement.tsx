import { useEffect, useState } from 'react'
import { ItemCardapio } from '@/types'
import { fetchCardapio, updateProductDisponivel, updateProductPreco } from '@/services/api/cardapio.service'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/utils/calc'

export function QuickMenuManagement() {
  const [itens, setItens] = useState<ItemCardapio[]>([])
  const [editingPreco, setEditingPreco] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchCardapio().then(setItens).catch(console.error)
  }, [])

  async function handleToggleDisponivel(id: string, current: boolean) {
    try {
      await updateProductDisponivel(id, !current)
      setItens((prev) =>
        prev.map((i) => (i.id === id ? { ...i, disponivel: !current } : i))
      )
    } catch (err) {
      console.error(err)
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
    } catch (err) {
      console.error(err)
    }
  }

  const categorias = [...new Set(itens.map((i) => i.categoria))]

  return (
    <div className="space-y-6">
      {categorias.map((cat) => (
        <div key={cat}>
          <h3 className="font-semibold text-lg border-b pb-1 mb-3">{cat}</h3>
          <div className="space-y-2">
            {itens.filter((i) => i.categoria === cat).map((item) => (
              <div key={item.id} className="flex items-center gap-3 border rounded-md p-3">
                <Switch
                  checked={item.disponivel}
                  onCheckedChange={() => handleToggleDisponivel(item.id, item.disponivel)}
                />
                <span className="flex-1 capitalize text-sm">{item.nome}</span>
                <div className="flex items-center gap-2">
                  {editingPreco[item.id] !== undefined ? (
                    <>
                      <Input
                        className="w-24 h-8 text-sm"
                        value={editingPreco[item.id]}
                        onChange={(e) =>
                          setEditingPreco((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                      />
                      <Button size="sm" className="h-8" onClick={() => handleSavePreco(item.id)}>
                        Salvar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8"
                        onClick={() =>
                          setEditingPreco((prev) => { const n = { ...prev }; delete n[item.id]; return n })
                        }
                      >
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <button
                      className="text-sm text-primary underline hover:no-underline"
                      onClick={() =>
                        setEditingPreco((prev) => ({ ...prev, [item.id]: String(item.preco) }))
                      }
                    >
                      {formatBRL(item.preco)}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
