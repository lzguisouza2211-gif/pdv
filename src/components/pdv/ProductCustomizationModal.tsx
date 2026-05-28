import { useState, useEffect } from 'react'
import { ItemCardapio, ExtraOption, Adicional } from '@/types'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { formatBRL } from '@/utils/calc'
import { ChevronDown, Plus, Minus, X } from 'lucide-react'
import { fetchAdicionaisByProduct, fetchRetiradosByProduct } from '@/services/api/cardapio.service'

const MAX_QTY = 5

const CATEGORY_STYLE: Record<string, { emoji: string; from: string; to: string }> = {
  Lanches:  { emoji: '🍔', from: 'from-orange-400', to: 'to-amber-300' },
  Macarrão: { emoji: '🍝', from: 'from-yellow-400', to: 'to-amber-300' },
  Porções:  { emoji: '🍟', from: 'from-green-400',  to: 'to-emerald-400' },
  Omeletes: { emoji: '🍳', from: 'from-yellow-300', to: 'to-orange-300' },
  Bebidas:  { emoji: '🥤', from: 'from-blue-400',   to: 'to-cyan-400' },
  Cervejas: { emoji: '🍺', from: 'from-amber-400',  to: 'to-yellow-300' },
  Doces:    { emoji: '🍰', from: 'from-pink-400',   to: 'to-rose-400' },
}

interface Props {
  item: ItemCardapio | null
  open: boolean
  onClose: () => void
  onConfirm: (extras: ExtraOption[], observacoes: string, qty: number) => void
  initialAddQtys?: Record<string, number>
  initialSelectedRem?: Set<string>
  initialObservacoes?: string
  initialQty?: number
  confirmLabel?: string
}

interface DropdownSectionProps {
  title: string
  badgeCount: number
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}

function DropdownSection({ title, badgeCount, isOpen, onToggle, children }: DropdownSectionProps) {
  return (
    <div className="border-2 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{title}</span>
          {badgeCount > 0 && (
            <Badge className="text-xs h-5 px-1.5 bg-primary text-primary-foreground">
              {badgeCount}
            </Badge>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="px-4 py-3 space-y-3 border-t bg-background">
          {children}
        </div>
      )}
    </div>
  )
}

export function ProductCustomizationModal({
  item, open, onClose, onConfirm,
  initialAddQtys, initialSelectedRem, initialObservacoes, initialQty, confirmLabel,
}: Props) {
  const [adicionais, setAdicionais] = useState<Adicional[]>([])
  const [retiradas, setRetiradas] = useState<string[]>([])
  const [addQtys, setAddQtys] = useState<Record<string, number>>({})
  const [selectedRem, setSelectedRem] = useState<Set<string>>(new Set())
  const [observacoes, setObservacoes] = useState('')
  const [qty, setItemQty] = useState(initialQty ?? 1)
  const [loading, setLoading] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [remOpen, setRemOpen] = useState(false)

  useEffect(() => {
    if (!item || !open) return
    setAddQtys(initialAddQtys ?? {})
    setSelectedRem(initialSelectedRem ? new Set(initialSelectedRem) : new Set())
    setObservacoes(initialObservacoes ?? '')
    setItemQty(initialQty ?? 1)
    setAddOpen(false)
    setRemOpen(false)
    setLoading(true)

    Promise.all([
      fetchAdicionaisByProduct(item.id),
      fetchRetiradosByProduct(item.id),
    ])
      .then(([ads, rets]) => {
        setAdicionais(ads)
        setRetiradas(rets.length > 0 ? rets : item.ingredientes)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [item, open])

  function setQty(nome: string, value: number) {
    setAddQtys((prev) => ({ ...prev, [nome]: Math.max(0, Math.min(MAX_QTY, value)) }))
  }

  function toggleRem(nome: string) {
    setSelectedRem((prev) => {
      const next = new Set(prev)
      next.has(nome) ? next.delete(nome) : next.add(nome)
      return next
    })
  }

  function handleConfirm() {
    const extras: ExtraOption[] = [
      ...adicionais
        .filter((a) => (addQtys[a.nome] ?? 0) > 0)
        .map((a) => ({ nome: a.nome, preco: a.preco, tipo: 'add' as const, qty: addQtys[a.nome] })),
      ...[...selectedRem].map((nome) => ({ nome, preco: 0, tipo: 'remove' as const })),
    ]
    onConfirm(extras, observacoes.trim(), qty)
    onClose()
  }

  const totalAddQty = Object.values(addQtys).reduce((s, q) => s + (q > 0 ? q : 0), 0)
  const addTotal = adicionais
    .filter((a) => (addQtys[a.nome] ?? 0) > 0)
    .reduce((s, a) => s + a.preco * (addQtys[a.nome] ?? 0), 0)
  const totalItem = item ? (item.preco + addTotal) * qty : 0

  if (!item || !open) return null

  const style = CATEGORY_STYLE[item.categoria] ?? { emoji: '🍽️', from: 'from-slate-400', to: 'to-slate-300' }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/50 drawer-overlay"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-background rounded-t-3xl max-h-[88vh] shadow-2xl sheet-bottom">
        {/* Banner da categoria */}
        <div className={`relative bg-gradient-to-br ${style.from} ${style.to} h-32 rounded-t-3xl flex-shrink-0 flex items-end`}>
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-6xl drop-shadow">
            {style.emoji}
          </span>
          <button
            onClick={onClose}
            className="absolute top-3 right-3 bg-black/25 hover:bg-black/40 rounded-full p-1.5 transition-colors"
          >
            <X className="h-4 w-4 text-white" />
          </button>
          <div className="px-5 pb-4 w-full">
            <h2 className="text-white font-extrabold text-xl capitalize leading-tight drop-shadow-sm">
              {item.nome}
            </h2>
            <p className="text-white/80 text-sm font-medium">{formatBRL(item.preco)}</p>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loading ? (
            <p className="text-center py-6 text-muted-foreground">Carregando opções…</p>
          ) : (
            <>
              {adicionais.length > 0 && (
                <DropdownSection
                  title="Adicionais"
                  badgeCount={totalAddQty}
                  isOpen={addOpen}
                  onToggle={() => setAddOpen((v) => !v)}
                >
                  {adicionais.map((a) => {
                    const q = addQtys[a.nome] ?? 0
                    const subtotal = a.preco * q
                    return (
                      <div key={a.id} className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm capitalize leading-tight font-medium">{a.nome}</p>
                          <p className="text-xs text-primary font-semibold">
                            +{formatBRL(a.preco)}
                            {q > 1 && <span className="text-muted-foreground font-normal"> · {formatBRL(subtotal)}</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setQty(a.nome, q - 1)}
                            disabled={q === 0}
                            className="h-8 w-8 rounded-full border-2 flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-5 text-center text-sm font-bold tabular-nums">{q}</span>
                          <button
                            type="button"
                            onClick={() => setQty(a.nome, q + 1)}
                            disabled={q >= MAX_QTY}
                            className="h-8 w-8 rounded-full border-2 border-primary flex items-center justify-center disabled:opacity-30 hover:bg-primary/10 transition-colors"
                          >
                            <Plus className="h-3 w-3 text-primary" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </DropdownSection>
              )}

              {retiradas.length > 0 && (
                <DropdownSection
                  title="Retirar ingredientes"
                  badgeCount={selectedRem.size}
                  isOpen={remOpen}
                  onToggle={() => setRemOpen((v) => !v)}
                >
                  {retiradas.map((nome) => (
                    <div key={nome} className="flex items-center gap-2">
                      <Checkbox
                        id={`rem-${nome}`}
                        checked={selectedRem.has(nome)}
                        onCheckedChange={() => toggleRem(nome)}
                      />
                      <Label htmlFor={`rem-${nome}`} className="capitalize cursor-pointer text-sm font-medium">
                        sem {nome}
                      </Label>
                    </div>
                  ))}
                </DropdownSection>
              )}

              {/* Quantidade */}
              <div className="border-2 rounded-2xl px-4 py-3.5 flex items-center justify-between bg-muted/20">
                <span className="font-semibold text-sm">Quantidade</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setItemQty((q) => Math.max(1, q - 1))}
                    disabled={qty <= 1}
                    className="h-8 w-8 rounded-full border-2 flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-8 text-center font-extrabold text-lg tabular-nums">{qty}</span>
                  <button
                    type="button"
                    onClick={() => setItemQty((q) => Math.min(20, q + 1))}
                    disabled={qty >= 20}
                    className="h-8 w-8 rounded-full border-2 border-primary flex items-center justify-center disabled:opacity-30 hover:bg-primary/10 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5 text-primary" />
                  </button>
                </div>
              </div>

              {/* Observações */}
              <div>
                <label htmlFor="obs" className="text-sm font-semibold block mb-1.5">Observações</label>
                <textarea
                  id="obs"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Ex: sem sal, bem passado…"
                  className="w-full rounded-2xl border-2 border-input bg-background px-4 py-3 text-sm resize-none h-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>
            </>
          )}
        </div>

        {/* Botão de confirmação */}
        <div className="px-4 py-4 pb-safe border-t">
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-bold text-base shadow-lg flex items-center justify-between px-5 disabled:opacity-60 active:scale-[0.98] transition-all"
          >
            <span>{confirmLabel ?? (qty > 1 ? `Adicionar ${qty}x` : 'Adicionar ao carrinho')}</span>
            <span className="bg-primary-foreground/20 px-3 py-1 rounded-full text-sm font-extrabold">
              {formatBRL(totalItem)}
            </span>
          </button>
        </div>
      </div>
    </>
  )
}
