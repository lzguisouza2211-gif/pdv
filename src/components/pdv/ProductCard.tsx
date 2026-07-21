import React from 'react'
import { ItemCardapio } from '@/types'
import { formatBRL } from '@/utils/calc'
import { Minus, Plus } from 'lucide-react'

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

interface Props {
  item: ItemCardapio
  onAdd: (item: ItemCardapio, e: React.MouseEvent) => void
  onRemove?: () => void
  storeOpen: boolean
  qty?: number
}

export function ProductCard({ item, onAdd, onRemove, storeOpen, qty = 0 }: Props) {
  const indisponiveis = item.ingredientes_indisponiveis ?? []
  const style = CATEGORY_STYLE[item.categoria] ?? { emoji: '🍽️', tint: '#F0F0F0' }
  const disabled = !storeOpen || !item.disponivel

  return (
    <div style={{ width: 132, flexShrink: 0 }}>
      <div
        className="relative"
        style={{ width: 132, height: 132, opacity: disabled ? 0.55 : 1 }}
      >
        <div
          onClick={(e) => !disabled && onAdd(item, e)}
          style={{
            width: 132, height: 132, borderRadius: 16, background: style.tint,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', overflow: 'hidden',
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.04)',
            cursor: disabled ? 'default' : 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(120% 90% at 30% 20%, rgba(255,255,255,0.55), transparent 60%)',
          }} />
          <span style={{
            fontSize: 52, lineHeight: 1,
            filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.12))',
            position: 'relative',
          }}>
            {style.emoji}
          </span>
          {!item.disponivel && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="text-white font-bold text-xs tracking-wide">Indisponível</span>
            </div>
          )}
        </div>

        {/* Stepper / add — posicionado sobre o canto inferior direito */}
        <div style={{ position: 'absolute', right: -6, bottom: -6 }}>
          {qty > 0 ? (
            <div style={{
              display: 'flex', alignItems: 'center', background: '#fff',
              borderRadius: 999, boxShadow: '0 2px 8px rgba(0,0,0,0.16)', height: 32,
            }}>
              <button
                onClick={() => onRemove?.()}
                disabled={disabled}
                style={{
                  width: 32, height: 32, borderRadius: 999, border: 'none',
                  background: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16202E',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <Minus size={13} />
              </button>
              <span style={{ minWidth: 16, textAlign: 'center', fontWeight: 800, color: '#16202E', fontSize: 14 }}>
                {qty}
              </span>
              <button
                onClick={(e) => !disabled && onAdd(item, e)}
                disabled={disabled}
                style={{
                  width: 32, height: 32, borderRadius: 999, border: 'none',
                  background: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F4581C',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <Plus size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => !disabled && onAdd(item, e)}
              disabled={disabled}
              style={{
                width: 32, height: 32, borderRadius: 999,
                border: '1.5px solid #ECECEF',
                background: '#fff', color: '#F4581C',
                cursor: disabled ? 'default' : 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <Plus size={14} />
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: 8, opacity: disabled ? 0.55 : 1 }}>
        <p style={{
          fontWeight: 700, color: '#16202E', fontSize: 13, lineHeight: 1.25, marginBottom: 3,
        }} className="line-clamp-2">
          {item.nome}
        </p>
        <span style={{ fontWeight: 800, color: '#16202E', fontSize: 13.5 }}>{formatBRL(item.preco)}</span>
        {indisponiveis.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {indisponiveis.map((ing) => (
              <span
                key={ing}
                className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20"
              >
                sem {ing}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
