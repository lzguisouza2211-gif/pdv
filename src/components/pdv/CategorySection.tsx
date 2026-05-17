import { ItemCardapio } from '@/types'
import { ProductCard } from './ProductCard'

interface Props {
  categoria: string
  itens: ItemCardapio[]
  onAdd: (item: ItemCardapio) => void
  storeOpen: boolean
}

export function CategorySection({ categoria, itens, onAdd, storeOpen }: Props) {
  if (itens.length === 0) return null

  return (
    <section className="mb-8">
      <h2 className="mb-4 text-2xl font-bold text-foreground border-b border-border pb-2">
        {categoria}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {itens.map((item) => (
          <ProductCard key={item.id} item={item} onAdd={onAdd} storeOpen={storeOpen} />
        ))}
      </div>
    </section>
  )
}
