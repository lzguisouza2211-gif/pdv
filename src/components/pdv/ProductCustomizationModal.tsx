import { useState, useEffect } from 'react'
import { ItemCardapio, ExtraOption, Adicional } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { formatBRL } from '@/utils/calc'
import { ChevronDown, Plus, Minus } from 'lucide-react'
import { fetchAdicionaisByProduct, fetchRetiradosByProduct } from '@/services/api/cardapio.service'

const MAX_QTY = 5

interface Props {
  item: ItemCardapio | null
  open: boolean
  onClose: () => void
  onConfirm: (extras: ExtraOption[], observacoes: string) => void
  initialAddQtys?: Record<string, number>   // nome → qty (para edição)
  initialSelectedRem?: Set<string>
  initialObservacoes?: string
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
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{title}</span>
          {badgeCount > 0 && (
            <Badge variant="secondary" className="text-xs h-5 px-1.5">
              {badgeCount}
            </Badge>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="px-4 py-3 space-y-2.5 border-t bg-background">
          {children}
        </div>
      )}
    </div>
  )
}

export function ProductCustomizationModal({
  item, open, onClose, onConfirm,
  initialAddQtys, initialSelectedRem, initialObservacoes, confirmLabel,
}: Props) {
  const [adicionais, setAdicionais] = useState<Adicional[]>([])
  const [retiradas, setRetiradas] = useState<string[]>([])
  const [addQtys, setAddQtys] = useState<Record<string, number>>({})
  const [selectedRem, setSelectedRem] = useState<Set<string>>(new Set())
  const [observacoes, setObservacoes] = useState('')
  const [loading, setLoading] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [remOpen, setRemOpen] = useState(false)

  useEffect(() => {
    if (!item || !open) return
    setAddQtys(initialAddQtys ?? {})
    setSelectedRem(initialSelectedRem ? new Set(initialSelectedRem) : new Set())
    setObservacoes(initialObservacoes ?? '')
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

  function setQty(nome: string, qty: number) {
    setAddQtys((prev) => ({ ...prev, [nome]: Math.max(0, Math.min(MAX_QTY, qty)) }))
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
    onConfirm(extras, observacoes.trim())
    onClose()
  }

  const totalAddQty = Object.values(addQtys).reduce((s, q) => s + (q > 0 ? q : 0), 0)

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="capitalize">{item.nome}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-center py-4 text-muted-foreground">Carregando opções…</p>
        ) : (
          <div className="space-y-3">
            {adicionais.length > 0 && (
              <DropdownSection
                title="Adicionais"
                badgeCount={totalAddQty}
                isOpen={addOpen}
                onToggle={() => setAddOpen((v) => !v)}
              >
                {adicionais.map((a) => {
                  const qty = addQtys[a.nome] ?? 0
                  const subtotal = a.preco * qty
                  return (
                    <div key={a.id} className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm capitalize leading-tight">{a.nome}</p>
                        <p className="text-xs text-primary font-medium">
                          +{formatBRL(a.preco)} cada
                          {qty > 1 && <span className="text-muted-foreground"> · {formatBRL(subtotal)}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setQty(a.nome, qty - 1)}
                          disabled={qty === 0}
                          className="h-7 w-7 rounded-md border flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-5 text-center text-sm font-semibold tabular-nums">{qty}</span>
                        <button
                          type="button"
                          onClick={() => setQty(a.nome, qty + 1)}
                          disabled={qty >= MAX_QTY}
                          className="h-7 w-7 rounded-md border flex items-center justify-center disabled:opacity-30 hover:bg-muted transition-colors"
                        >
                          <Plus className="h-3 w-3" />
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
                    <Label htmlFor={`rem-${nome}`} className="capitalize cursor-pointer text-sm">
                      sem {nome}
                    </Label>
                  </div>
                ))}
              </DropdownSection>
            )}

            <Separator />
            <div>
              <Label htmlFor="obs" className="font-semibold text-sm">Observações</Label>
              <textarea
                id="obs"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: sem sal, bem passado…"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {confirmLabel ?? 'Adicionar ao carrinho'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
