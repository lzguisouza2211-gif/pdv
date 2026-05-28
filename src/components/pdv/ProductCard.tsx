import { ItemCardapio } from '@/types'
import { formatBRL } from '@/utils/calc'

interface Props {
  item: ItemCardapio
  onAdd: (item: ItemCardapio) => void
  storeOpen: boolean
}

const CATEGORY_STYLE: Record<string, { emoji: string; from: string; to: string }> = {
  Lanches:  { emoji: '🍔', from: 'from-orange-400', to: 'to-amber-300' },
  Macarrão: { emoji: '🍝', from: 'from-yellow-400', to: 'to-amber-300' },
  Porções:  { emoji: '🍟', from: 'from-green-400',  to: 'to-emerald-400' },
  Omeletes: { emoji: '🍳', from: 'from-yellow-300', to: 'to-orange-300' },
  Bebidas:  { emoji: '🥤', from: 'from-blue-400',   to: 'to-cyan-400' },
  Cervejas: { emoji: '🍺', from: 'from-amber-400',  to: 'to-yellow-300' },
  Doces:    { emoji: '🍰', from: 'from-pink-400',   to: 'to-rose-400' },
}

export function ProductCard({ item, onAdd, storeOpen }: Props) {
  const indisponiveis = item.ingredientes_indisponiveis ?? []
  const style = CATEGORY_STYLE[item.categoria] ?? { emoji: '🍽️', from: 'from-slate-400', to: 'to-slate-300' }
  const disabled = !storeOpen || !item.disponivel

  return (
    <div
      className={`flex flex-col rounded-2xl border bg-card overflow-hidden shadow-sm transition-all duration-200 ${
        disabled ? 'opacity-60' : 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer'
      }`}
    >
      {/* Banner colorido */}
      <div className={`relative bg-gradient-to-br ${style.from} ${style.to} h-24 flex items-center justify-center`}>
        <span className="text-5xl drop-shadow">{style.emoji}</span>
        {!item.disponivel && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white font-bold text-sm tracking-wide">Indisponível</span>
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex flex-col flex-1 p-3 gap-2">
        <div className="flex-1">
          <h3 className="font-bold text-base leading-tight capitalize">{item.nome}</h3>
          {item.descricao && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
              {item.descricao}
            </p>
          )}
          {indisponiveis.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {indisponiveis.map((ing) => (
                <span
                  key={ing}
                  className="text-xs px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20"
                >
                  sem {ing}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-1 mt-auto">
          <span className="text-lg font-extrabold text-primary">{formatBRL(item.preco)}</span>
          <button
            onClick={() => onAdd(item)}
            disabled={disabled}
            className="bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-sm font-bold disabled:opacity-40 hover:bg-primary/90 active:scale-95 transition-all shadow-sm"
          >
            + Pedir
          </button>
        </div>
      </div>
    </div>
  )
}
