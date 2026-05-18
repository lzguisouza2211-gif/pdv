import { ItemCardapio } from '@/types'
import { ProductCard } from './ProductCard'

interface Props {
  categoria?: string
  itens: ItemCardapio[]
  onAdd: (item: ItemCardapio) => void
  storeOpen: boolean
}

export function CategorySection({ itens, onAdd, storeOpen }: Props) {
  if (itens.length === 0) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
      {itens.map((item) => (
        <ProductCard key={item.id} item={item} onAdd={onAdd} storeOpen={storeOpen} />
      ))}
    </div>
  )
}
