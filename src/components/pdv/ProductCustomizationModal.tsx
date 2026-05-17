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
import { formatBRL } from '@/utils/calc'
import { fetchAdicionaisByProduct, fetchRetiradosByProduct } from '@/services/api/cardapio.service'

interface Props {
  item: ItemCardapio | null
  open: boolean
  onClose: () => void
  onConfirm: (extras: ExtraOption[], observacoes: string) => void
}

export function ProductCustomizationModal({ item, open, onClose, onConfirm }: Props) {
  const [adicionais, setAdicionais] = useState<Adicional[]>([])
  const [retiradas, setRetiradas] = useState<string[]>([])
  const [selectedAdd, setSelectedAdd] = useState<Set<string>>(new Set())
  const [selectedRem, setSelectedRem] = useState<Set<string>>(new Set())
  const [observacoes, setObservacoes] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!item || !open) return
    setSelectedAdd(new Set())
    setSelectedRem(new Set())
    setObservacoes('')
    setLoading(true)

    Promise.all([
      fetchAdicionaisByProduct(item.id),
      fetchRetiradosByProduct(item.id),
    ])
      .then(([ads, rets]) => {
        setAdicionais(ads)
        setRetiradas(rets)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [item, open])

  function toggleAdd(nome: string) {
    setSelectedAdd((prev) => {
      const next = new Set(prev)
      next.has(nome) ? next.delete(nome) : next.add(nome)
      return next
    })
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
        .filter((a) => selectedAdd.has(a.nome))
        .map((a) => ({ nome: a.nome, preco: a.preco, tipo: 'add' as const })),
      ...[...selectedRem].map((nome) => ({ nome, preco: 0, tipo: 'remove' as const })),
    ]
    onConfirm(extras, observacoes.trim())
    onClose()
  }

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
          <div className="space-y-4">
            {adicionais.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Adicionais</h4>
                <div className="space-y-2">
                  {adicionais.map((a) => (
                    <div key={a.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`add-${a.id}`}
                          checked={selectedAdd.has(a.nome)}
                          onCheckedChange={() => toggleAdd(a.nome)}
                        />
                        <Label htmlFor={`add-${a.id}`} className="capitalize cursor-pointer">
                          {a.nome}
                        </Label>
                      </div>
                      <span className="text-sm text-primary font-medium">
                        +{formatBRL(a.preco)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {retiradas.length > 0 && (
              <>
                {adicionais.length > 0 && <Separator />}
                <div>
                  <h4 className="font-semibold mb-2">Retirar ingredientes</h4>
                  <div className="space-y-2">
                    {retiradas.map((nome) => (
                      <div key={nome} className="flex items-center gap-2">
                        <Checkbox
                          id={`rem-${nome}`}
                          checked={selectedRem.has(nome)}
                          onCheckedChange={() => toggleRem(nome)}
                        />
                        <Label htmlFor={`rem-${nome}`} className="capitalize cursor-pointer">
                          sem {nome}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator />
            <div>
              <Label htmlFor="obs" className="font-semibold">Observações</Label>
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
            Adicionar ao carrinho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
