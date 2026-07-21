import React from 'react'
import { ItemCardapio } from '@/types'
import { ProductCard } from './ProductCard'

interface Props {
  categoria?: string
  itens: ItemCardapio[]
  onAdd: (item: ItemCardapio, e: React.MouseEvent) => void
  onRemove?: (item: ItemCardapio) => void
  storeOpen: boolean
  cartQtys?: Record<string, number>
}

export function CategorySection({ itens, onAdd, onRemove, storeOpen, cartQtys = {} }: Props) {
  if (itens.length === 0) return null

  return (
    <div
      className="no-scrollbar"
      style={{ display: 'flex', gap: 14, overflowX: 'auto', padding: '10px 2px 6px' }}
    >
      {itens.map((item) => (
        <ProductCard
          key={item.id}
          item={item}
          onAdd={onAdd}
          onRemove={onRemove ? () => onRemove(item) : undefined}
          storeOpen={storeOpen}
          qty={cartQtys[item.id] ?? 0}
        />
      ))}
    </div>
  )
}
