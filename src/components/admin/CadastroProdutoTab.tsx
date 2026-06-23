import { FormEvent, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { createProduct, fetchCardapio } from '@/services/api/cardapio.service'

interface Props {
  onCreated: () => void
}

export function CadastroProdutoTab({ onCreated }: Props) {
  const { toast } = useToast()
  const [nome, setNome] = useState('')
  const [preco, setPreco] = useState('')
  const [categoria, setCategoria] = useState('')
  const [descricao, setDescricao] = useState('')
  const [saving, setSaving] = useState(false)
  const [categoriasBase, setCategoriasBase] = useState<string[]>([])

  function formatBRLInput(value: string): string {
    const digits = value.replace(/\D/g, '')
    if (!digits) return ''
    const amount = Number(digits) / 100
    return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  useEffect(() => {
    fetchCardapio()
      .then((items) => {
        const cats = [...new Set(items.map((i) => i.categoria))].sort((a, b) => a.localeCompare(b))
        setCategoriasBase(cats)
      })
      .catch(() => {})
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (saving) return

    const nomeClean = nome.trim()
    const categoriaClean = categoria.trim()
    const precoNum = Number(preco.replace(/\D/g, '')) / 100

    if (!nomeClean || !categoriaClean || Number.isNaN(precoNum) || precoNum <= 0) {
      toast({
        title: 'Dados invalidos',
        description: 'Preencha nome, categoria e um preco maior que zero.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      await createProduct({
        nome: nomeClean,
        categoria: categoriaClean,
        preco: precoNum,
        descricao: descricao.trim() || undefined,
      })

      toast({ title: 'Produto cadastrado com sucesso' })
      setNome('')
      setPreco('')
      setDescricao('')
      onCreated()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao foi possivel cadastrar o produto.'
      toast({
        title: 'Erro ao cadastrar produto',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-6">
      <h3 className="text-lg font-semibold">Novo produto</h3>
      <p className="text-sm text-muted-foreground mt-1">
        Cadastre itens sem precisar abrir SQL no Supabase.
      </p>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="produto-nome">Nome</Label>
          <Input
            id="produto-nome"
            placeholder="Ex.: X-Bacon Especial"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="produto-preco">Preco</Label>
            <Input
              id="produto-preco"
              type="text"
              inputMode="numeric"
              placeholder="R$ 0,00"
              value={preco}
              onChange={(e) => setPreco(formatBRLInput(e.target.value))}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="produto-categoria">Categoria</Label>
            <Input
              id="produto-categoria"
              list="categorias-cardapio"
              placeholder="Ex.: Lanches"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              required
            />
            <datalist id="categorias-cardapio">
              {categoriasBase.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="produto-descricao">Descricao (opcional)</Label>
          <Input
            id="produto-descricao"
            placeholder="Ingredientes principais ou observacao"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Cadastrar produto'}
          </Button>
        </div>
      </form>
    </div>
  )
}
