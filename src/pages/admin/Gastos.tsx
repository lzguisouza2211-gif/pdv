import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { listarCategorias, criarGasto } from '@/services/api/gastos.service'
import { CategoriaGasto, OrigemGasto, FormaPagamento } from '@/types'

const ORIGENS: { value: OrigemGasto; label: string }[] = [
  { value: 'lanche',  label: 'Lanchonete' },
  { value: 'pessoal', label: 'Pessoal'    },
]

const FORMAS: { value: FormaPagamento; label: string }[] = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix',      label: 'PIX'      },
  { value: 'cartao',   label: 'Cartão'   },
]

const BTN = (active: boolean) =>
  `py-2.5 rounded-lg border font-medium text-sm leading-tight transition-colors ${
    active ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'
  }`

const parseValor = (v: string) => parseFloat(v.replace(/\./g, '').replace(',', '.'))

export function Gastos() {
  const { toast } = useToast()

  const [valor, setValor] = useState('')
  const [origem, setOrigem] = useState<OrigemGasto | null>(null)
  const [categoriaId, setCategoriaId] = useState<number | null>(null)
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | null>(null)
  const [fornecedor, setFornecedor] = useState('')
  const [categorias, setCategorias] = useState<CategoriaGasto[]>([])
  const [loadingCats, setLoadingCats] = useState(false)
  const [errCats, setErrCats] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const fetchCategorias = useCallback(async (o: OrigemGasto) => {
    setLoadingCats(true)
    setErrCats(false)
    try {
      const data = await listarCategorias(o)
      setCategorias(data)
    } catch {
      setErrCats(true)
    } finally {
      setLoadingCats(false)
    }
  }, [])

  useEffect(() => {
    if (!origem) { setCategorias([]); return }
    setCategoriaId(null)
    fetchCategorias(origem)
  }, [origem, fetchCategorias])

  async function handleSalvar() {
    if (!origem || categoriaId === null || !formaPagamento) return
    const valorNum = parseValor(valor)
    if (!valorNum || valorNum <= 0) return

    setSalvando(true)
    try {
      await criarGasto({
        valor: valorNum,
        origem,
        categoria_id: categoriaId,
        forma_pagamento: formaPagamento,
        fornecedor: fornecedor.trim() || undefined,
      })
      toast({
        title: 'Gasto registrado!',
        description: `R$ ${valorNum.toFixed(2).replace('.', ',')} salvo com sucesso.`,
      })
      setValor('')
      setCategoriaId(null)
      setFormaPagamento(null)
      setFornecedor('')
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  const valorNum = parseValor(valor)
  const podeSalvar = origem !== null && categoriaId !== null && formaPagamento !== null
    && valorNum > 0 && !salvando

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="text-xl font-bold">Registrar Gasto</h1>

      <Card>
        <CardContent className="pt-5 space-y-5">

          {/* Valor */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">
              Valor
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium select-none">
                R$
              </span>
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={valor}
                onChange={e => setValor(e.target.value)}
                className="pl-9 text-2xl font-bold h-14"
              />
            </div>
          </div>

          {/* Origem */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">
              Origem
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {ORIGENS.map(o => (
                <button key={o.value} onClick={() => setOrigem(o.value)} className={BTN(origem === o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Categoria — sempre visível após escolher origem */}
          {origem && (
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">
                Categoria
              </Label>
              {loadingCats ? (
                <p className="text-sm text-muted-foreground py-2">Carregando categorias…</p>
              ) : errCats ? (
                <div className="space-y-2">
                  <p className="text-sm text-destructive">Erro ao carregar categorias.</p>
                  <Button variant="outline" size="sm" onClick={() => fetchCategorias(origem)}>
                    Tentar novamente
                  </Button>
                </div>
              ) : categorias.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Nenhuma categoria cadastrada para esta origem.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {categorias.map(cat => (
                    <button key={cat.id} onClick={() => setCategoriaId(cat.id)} className={BTN(categoriaId === cat.id)}>
                      {cat.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Forma de pagamento */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">
              Forma de pagamento
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {FORMAS.map(f => (
                <button key={f.value} onClick={() => setFormaPagamento(f.value)} className={BTN(formaPagamento === f.value)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fornecedor */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block">
              Fornecedor / destinatário
            </Label>
            <Input
              placeholder="Onde/para quem foi pago (opcional)"
              value={fornecedor}
              onChange={e => setFornecedor(e.target.value)}
            />
          </div>

          <Button className="w-full h-12 text-base font-bold" disabled={!podeSalvar} onClick={handleSalvar}>
            {salvando ? 'Salvando…' : 'Salvar gasto'}
          </Button>

        </CardContent>
      </Card>
    </div>
  )
}
