import { ItemCardapio } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/utils/calc'

interface Props {
  item: ItemCardapio
  onAdd: (item: ItemCardapio) => void
  storeOpen: boolean
}

export function ProductCard({ item, onAdd, storeOpen }: Props) {
  const indisponiveis = item.ingredientes_indisponiveis ?? []

  return (
    <div className="flex flex-col justify-between rounded-lg border bg-card p-4 shadow-sm gap-3">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold capitalize text-foreground">{item.nome}</h3>
          {!item.disponivel && (
            <Badge variant="destructive" className="shrink-0">Indisponível</Badge>
          )}
        </div>
        {item.descricao && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{item.descricao}</p>
        )}
        {indisponiveis.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {indisponiveis.map((ing) => (
              <Badge key={ing} variant="outline" className="text-xs text-destructive border-destructive">
                sem {ing}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-lg font-bold text-primary">{formatBRL(item.preco)}</span>
        <Button
          size="sm"
          onClick={() => onAdd(item)}
          disabled={!storeOpen || !item.disponivel}
        >
          Adicionar
        </Button>
      </div>
    </div>
  )
}
