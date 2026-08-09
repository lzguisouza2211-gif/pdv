import { useState, useEffect } from 'react'
import { ItemCardapio, ExtraOption, Adicional } from '@/types'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { formatBRL } from '@/utils/calc'
import { ChevronDown, Plus, Minus, X } from 'lucide-react'
import { fetchAdicionaisByProduct, fetchRetiradosByProduct } from '@/services/api/cardapio.service'
import { fetchIngredientesIndisponiveis } from '@/services/api/ingredientes.service'
import { CATEGORIAS_COM_SABOR } from '@/config/cardapio'


const CATEGORY_STYLE: Record<string, { emoji: string; tint: string }> = {
  Lanches:  { emoji: '🍔', tint: '#FFE8D6' },
  Macarrão: { emoji: '🍝', tint: '#FEF0C7' },
  Porções:  { emoji: '🍟', tint: '#DCF6E3' },
  Omeletes: { emoji: '🍳', tint: '#FFEFD0' },
  Bebidas:  { emoji: '🥤', tint: '#DEF0FB' },
  Cervejas: { emoji: '🍺', tint: '#FEF3CC' },
  Doces:    { emoji: '🍰', tint: '#FCE3EC' },
  Chicletes: { emoji: '🍬', tint: '#E8F5E9' },
}

const MAX_QTY = 5

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
  allowMultipleAdicionais?: boolean
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
        <div className="px-5 py-1 divide-y divide-border border-t bg-background">
          {children}
        </div>
      )}
    </div>
  )
}

export function ProductCustomizationModal({
  item, open, onClose, onConfirm,
  initialAddQtys, initialSelectedRem, initialObservacoes, initialQty, confirmLabel,
  allowMultipleAdicionais = false,
}: Props) {
  const [adicionais, setAdicionais] = useState<Adicional[]>([])
  const [retiradas, setRetiradas] = useState<string[]>([])
  const [indisponiveis, setIndisponiveis] = useState<Set<string>>(new Set())
  const [addQtys, setAddQtys] = useState<Record<string, number>>({})
  const [selectedRem, setSelectedRem] = useState<Set<string>>(new Set())
  const [selectedSabor, setSelectedSabor] = useState<string | null>(null)
  const [observacoes, setObservacoes] = useState('')
  const [qty, setItemQty] = useState(initialQty ?? 1)
  const [loading, setLoading] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [remOpen, setRemOpen] = useState(false)

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
    if (!item || !open) return
    setAddQtys(initialAddQtys ?? {})
    setSelectedRem(initialSelectedRem ? new Set(initialSelectedRem) : new Set())
    setSelectedSabor(null)
    setObservacoes(initialObservacoes ?? '')
    setItemQty(initialQty ?? 1)
    setAddOpen(false)
    setRemOpen(false)
    setLoading(true)

    Promise.all([
      fetchAdicionaisByProduct(item.id),
      fetchRetiradosByProduct(item.id),
      fetchIngredientesIndisponiveis(),
    ])
      .then(([ads, rets, indis]) => {
        setAdicionais(ads)
        setRetiradas(rets.length > 0 ? rets : item.ingredientes)
        setIndisponiveis(new Set(indis.filter((i) => i.indisponivel).map((i) => i.ingrediente)))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [item, open])

  function setQty(nome: string, value: number) {
    setAddQtys((prev) => ({ ...prev, [nome]: value }))
  }

  function toggleRem(nome: string) {
    setSelectedRem((prev) => {
      const next = new Set(prev)
      next.has(nome) ? next.delete(nome) : next.add(nome)
      return next
    })
  }

  const temSabor = item ? CATEGORIAS_COM_SABOR.has(item.categoria) : false
  const sabores = temSabor ? adicionais.filter((a) => a.preco === 0) : []
  const paidAdicionais = temSabor ? adicionais.filter((a) => a.preco > 0) : adicionais

  function handleConfirm() {
    const extras: ExtraOption[] = [
      ...(selectedSabor ? [{ nome: selectedSabor, preco: 0, tipo: 'add' as const, qty: 1 }] : []),
      ...paidAdicionais
        .filter((a) => (addQtys[a.nome] ?? 0) > 0)
        .map((a) => ({ nome: a.nome, preco: a.preco, tipo: 'add' as const, qty: allowMultipleAdicionais ? (addQtys[a.nome] ?? 1) : 1 })),
      ...[...selectedRem].map((nome) => ({ nome, preco: 0, tipo: 'remove' as const })),
    ]
    onConfirm(extras, observacoes.trim(), qty)
    onClose()
  }

  const totalAddQty = Object.values(addQtys).reduce((s, q) => s + (q > 0 ? q : 0), 0)
  const addTotal = paidAdicionais
    .filter((a) => (addQtys[a.nome] ?? 0) > 0)
    .reduce((s, a) => s + a.preco * (addQtys[a.nome] ?? 0), 0)
  const totalItem = item ? (item.preco + addTotal) * qty : 0

  if (!item || !open) return null

  const style = CATEGORY_STYLE[item.categoria] ?? { emoji: '🍽️', tint: '#F0F0F0' }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/50 drawer-overlay"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-background rounded-t-3xl max-h-[88vh] shadow-2xl sheet-bottom">
        {/* Grab handle */}
        <div style={{ width: 40, height: 5, borderRadius: 999, background: '#E0E2E7', margin: '10px auto 0', flexShrink: 0 }} />

        {/* Header com emoji thumb */}
        <div className="flex-shrink-0 px-5 pt-3 pb-2">
          <div className="flex justify-end mb-2">
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
          <div className="flex justify-center mb-4">
            <div style={{
              width: 110, height: 110, borderRadius: 20, background: style.tint,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', overflow: 'hidden',
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.04)',
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'radial-gradient(120% 90% at 30% 20%, rgba(255,255,255,0.55), transparent 60%)',
              }} />
              <span style={{ fontSize: 54, lineHeight: 1, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.12))', position: 'relative' }}>
                {style.emoji}
              </span>
            </div>
          </div>
          <h2 style={{ fontWeight: 800, fontSize: 20, color: '#16202E', marginBottom: 2, lineHeight: 1.2 }}>
            {item.nome}
          </h2>
          {item.descricao && (
            <p style={{ color: '#6B7280', fontSize: 13.5, lineHeight: 1.4, marginBottom: 6 }}>{item.descricao}</p>
          )}
          <p style={{ fontWeight: 800, color: '#16202E', fontSize: 17 }}>{formatBRL(item.preco)}</p>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ overscrollBehavior: 'contain' }}>
          {loading ? (
            <p className="text-center py-6 text-muted-foreground">Carregando opções…</p>
          ) : (
            <>
              {sabores.length > 0 && (
                <div className="border-2 rounded-2xl px-4 py-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">Sabor</span>
                    {!selectedSabor && (
                      <span className="text-xs text-destructive font-medium">Obrigatório</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sabores.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedSabor(selectedSabor === s.nome ? null : s.nome)}
                        className={`px-3 py-1.5 rounded-full border-2 text-sm font-medium transition-colors ${
                          selectedSabor === s.nome
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
                        }`}
                      >
                        {s.nome}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {paidAdicionais.length > 0 && (
                <DropdownSection
                  title="Adicionais"
                  badgeCount={totalAddQty}
                  isOpen={addOpen}
                  onToggle={() => setAddOpen((v) => !v)}
                >
                  {paidAdicionais.map((a) => {
                    const q = addQtys[a.nome] ?? 0
                    const selected = q > 0
                    const indisponivel = indisponiveis.has(a.nome)
                    return allowMultipleAdicionais ? (
                      <div key={a.id} className={`flex items-center justify-between gap-3 py-3.5 ${indisponivel ? 'opacity-50' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] capitalize leading-tight font-medium">{a.nome}</p>
                          <p className="text-sm text-primary font-semibold mt-0.5">
                            {indisponivel ? (
                              <span className="text-destructive">Indisponível</span>
                            ) : (
                              <>
                                {a.preco > 0 ? `+${formatBRL(a.preco)}` : 'Grátis'}
                                {q > 1 && a.preco > 0 && <span className="text-muted-foreground font-normal"> · {formatBRL(a.preco * q)} total</span>}
                              </>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setQty(a.nome, q - 1)}
                            disabled={q === 0 || indisponivel}
                            className="h-9 w-9 rounded-full border-2 flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-6 text-center text-base font-bold tabular-nums">{q}</span>
                          <button
                            type="button"
                            onClick={() => setQty(a.nome, q + 1)}
                            disabled={q >= MAX_QTY || indisponivel}
                            className="h-9 w-9 rounded-full border-2 border-primary flex items-center justify-center disabled:opacity-30 hover:bg-primary/10 transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5 text-primary" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div key={a.id} className={`flex items-center gap-3 py-3.5 ${indisponivel ? 'opacity-50' : ''}`}>
                        <Checkbox
                          id={`add-${a.nome}`}
                          checked={selected}
                          disabled={indisponivel}
                          onCheckedChange={() => setQty(a.nome, selected ? 0 : 1)}
                          className="h-5 w-5"
                        />
                        <Label
                          htmlFor={`add-${a.nome}`}
                          className={`flex-1 flex items-center justify-between capitalize text-[15px] font-medium ${indisponivel ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <span>{a.nome}</span>
                          <span className={indisponivel ? 'text-destructive font-semibold' : 'text-primary font-semibold'}>
                            {indisponivel ? 'Indisponível' : a.preco > 0 ? `+${formatBRL(a.preco)}` : 'Grátis'}
                          </span>
                        </Label>
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
                    <div key={nome} className="flex items-center gap-3 py-3.5">
                      <Checkbox
                        id={`rem-${nome}`}
                        checked={selectedRem.has(nome)}
                        onCheckedChange={() => toggleRem(nome)}
                        className="h-5 w-5"
                      />
                      <Label htmlFor={`rem-${nome}`} className="capitalize cursor-pointer text-[15px] font-medium">
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
            disabled={loading || (sabores.length > 0 && !selectedSabor)}
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
