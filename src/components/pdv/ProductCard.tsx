import React from 'react'
import { ItemCardapio } from '@/types'
import { formatBRL } from '@/utils/calc'
import { Minus, Plus } from 'lucide-react'

const CUSTOM_CATS = new Set(['Lanches', 'Macarrão', 'Omeletes', 'Bebidas', 'Chicletes', 'Doces'])

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
  const isCustom = CUSTOM_CATS.has(item.categoria)

  return (
    // Row sem onClick — evita add acidental durante scroll no mobile
    <div
      style={{ borderBottom: '1px solid #ECECEF', padding: '16px 0' }}
      className="flex gap-3"
    >
      {/* Info (somente leitura) */}
      <div className="flex-1 min-w-0" style={{ opacity: disabled ? 0.55 : 1 }}>
        <p style={{ fontWeight: 700, color: '#16202E', fontSize: 15, marginBottom: 4, lineHeight: 1.2 }}>
          {item.nome}
        </p>
        {item.descricao && (
          <p
            style={{ color: '#6B7280', fontSize: 13, lineHeight: 1.35, marginBottom: 6 }}
            className="line-clamp-2"
          >
            {item.descricao}
          </p>
        )}
        {indisponiveis.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
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
        <span style={{ fontWeight: 800, color: '#16202E', fontSize: 15 }}>{formatBRL(item.preco)}</span>
      </div>

      {/* Emoji thumb clicável + stepper */}
      <div
        className="relative flex-shrink-0"
        style={{ width: 96, height: 96, opacity: disabled ? 0.55 : 1 }}
      >
        {/* Thumb — área de toque para abrir/adicionar */}
        <div
          onClick={(e) => !disabled && onAdd(item, e)}
          style={{
            width: 96, height: 96, borderRadius: 16, background: style.tint,
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
            fontSize: 42, lineHeight: 1,
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
          {qty > 0 && !isCustom ? (
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
                position: 'relative',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <Plus size={14} />
              {qty > 0 && (
                <span style={{
                  position: 'absolute', top: -5, right: -5,
                  background: '#F4581C', color: '#fff',
                  borderRadius: 999, fontSize: 9, fontWeight: 800,
                  width: 15, height: 15,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {qty}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
