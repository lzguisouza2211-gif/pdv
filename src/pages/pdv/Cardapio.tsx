import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import React from 'react'
import { ItemCardapio, ExtraOption } from '@/types'
import { useCardapio } from '@/hooks/useCardapio'
import { useStoreStatus } from '@/hooks/useStoreStatus'
import { useDeliveryFee } from '@/hooks/useDeliveryFee'
import { useCart, calcItemPrice } from '@/store/useCart'
import { CategorySection } from '@/components/pdv/CategorySection'
import { ProductCustomizationModal } from '@/components/pdv/ProductCustomizationModal'
import { CartDrawer, CheckoutSuccess } from '@/components/pdv/CartDrawer'
import { SuccessModal } from '@/components/pdv/SuccessModal'
import { PhonePromptModal } from '@/components/pdv/PhonePromptModal'
import { AlertTriangle, Clock } from 'lucide-react'
import { gerarCartKey } from '@/utils/pedido'
import { getClienteSession, hasSkippedPrompt } from '@/services/api/clientes.service'
import { formatBRL } from '@/utils/calc'

const CATEGORIA_ORDER = ['Lanches', 'Macarrão', 'Porções', 'Omeletes', 'Bebidas', 'Cervejas', 'Doces']
const CUSTOM_CATS = new Set(['Lanches', 'Macarrão', 'Omeletes', 'Bebidas'])

const COPA_ITEM_NAMES_SET = new Set(['x-bacon', 'x-tudo', 'mineirão', 'batata c/ queijo e bacon', 'pernil e cebola'])

const CATEGORIA_META: Record<string, { emoji: string; tint: string }> = {
  Lanches:  { emoji: '🍔', tint: '#FFE8D6' },
  Macarrão: { emoji: '🍝', tint: '#FEF0C7' },
  Porções:  { emoji: '🍟', tint: '#DCF6E3' },
  Omeletes: { emoji: '🍳', tint: '#FFEFD0' },
  Bebidas:  { emoji: '🥤', tint: '#DEF0FB' },
  Cervejas: { emoji: '🍺', tint: '#FEF3CC' },
  Doces:    { emoji: '🍰', tint: '#FCE3EC' },
}

const NAV_HEIGHT = 56 // altura fixa da barra de abas (px)

export function Cardapio() {
  const { itens, loading, error } = useCardapio()
  const { status } = useStoreStatus()
  const { fee } = useDeliveryFee()
  const { items: cartItems, add, remove } = useCart()
  const [customItem, setCustomItem] = useState<ItemCardapio | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [successData, setSuccessData] = useState<CheckoutSuccess | null>(null)
  const [showPhonePrompt, setShowPhonePrompt] = useState(
    () => !getClienteSession() && !hasSkippedPrompt()
  )
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [catSheetOpen, setCatSheetOpen] = useState(false)
  const catRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const storeOpen = status?.is_open ?? true
  const tempoEspera = status?.tempo_espera_padrao ?? 30

  // Memoizado para não recriar observers a cada render
  const categorias = useMemo(() => [
    ...CATEGORIA_ORDER.filter((cat) => itens.some((i) => i.categoria === cat)),
    ...Array.from(new Set(itens.map((i) => i.categoria))).filter(
      (cat) => !CATEGORIA_ORDER.includes(cat)
    ),
  ], [itens])

  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0)
  const cartTotal = cartItems.reduce((s, i) => s + calcItemPrice(i) * i.qty, 0)

  const cartQtys = useMemo(() =>
    cartItems.reduce<Record<string, number>>((acc, i) => {
      acc[i.id] = (acc[i.id] || 0) + i.qty
      return acc
    }, {}),
  [cartItems])

  // Primeiro item disponível por categoria, até 5
  const highlights = useMemo(() =>
    CATEGORIA_ORDER
      .flatMap((cat) =>
        itens.filter((i) => i.categoria === cat && i.disponivel && i.ativo).slice(0, 1)
      )
      .slice(0, 5),
  [itens])


  // Scroll listener — detecta categoria ativa conforme o scroll
  // (mais confiável que IntersectionObserver no mobile)
  const updateActiveCat = useCallback(() => {
    const threshold = window.scrollY + NAV_HEIGHT + 24
    let active: string | null = categorias[0] ?? null
    for (const cat of categorias) {
      const el = catRefs.current[cat]
      if (!el) continue
      if (el.getBoundingClientRect().top + window.scrollY <= threshold) {
        active = cat
      }
    }
    setActiveCat((prev) => (prev === active ? prev : active))
  }, [categorias])

  useEffect(() => {
    window.addEventListener('scroll', updateActiveCat, { passive: true })
    updateActiveCat()
    return () => window.removeEventListener('scroll', updateActiveCat)
  }, [updateActiveCat])


  // Scroll manual — mais confiável que scrollIntoView+scrollMarginTop no mobile
  function scrollToCategory(cat: string) {
    const el = catRefs.current[cat]
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY - NAV_HEIGHT
    window.scrollTo({ top, behavior: 'smooth' })
    setActiveCat(cat)
  }

  function handleAdd(item: ItemCardapio, e: React.MouseEvent) {
    if (CUSTOM_CATS.has(item.categoria)) {
      setCustomItem(item)
    } else {
      const cartKey = gerarCartKey(item.id, [], '')
      add({
        cartKey,
        id: item.id,
        name: item.nome,
        price: item.preco,
        qty: 1,
        categoria: item.categoria,
        extras: [],
      })
      if ((window as any).CopaFX) {
        ;(window as any).CopaFX.flyBallToBag(e.clientX, e.clientY)
        ;(window as any).CopaFX.burstAt(e.clientX, e.clientY, { count: 14, power: 0.7 })
      }
    }
  }

  function handleRemove(item: ItemCardapio) {
    remove(gerarCartKey(item.id, [], ''))
  }

  function handleCustomConfirm(extras: ExtraOption[], observacoes: string, qty: number) {
    if (!customItem) return
    const cartKey = gerarCartKey(customItem.id, extras, observacoes)
    add({
      cartKey,
      id: customItem.id,
      name: customItem.nome,
      price: customItem.preco,
      qty,
      categoria: customItem.categoria,
      observacoes,
      extras,
    })
    if ((window as any).CopaFX) {
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      if (COPA_ITEM_NAMES_SET.has(customItem.nome)) {
        ;(window as any).CopaFX.goal('GOOOL!')
      } else {
        ;(window as any).CopaFX.burstAt(cx, cy, { count: 40, power: 1.2 })
      }
      ;(window as any).CopaFX.flyBallToBag(cx, cy)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F6F6F8' }}>

      {/* ── Banner ───────────────────────────────────────────── */}
      <div style={{
        position: 'relative', height: 210, flexShrink: 0, overflow: 'hidden',
        background: 'linear-gradient(160deg, #1E293B 0%, #11182A 70%)',
      }}>
        {/* Emojis de fundo Copa */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.09,
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', placeItems: 'center',
          transform: 'rotate(-8deg) scale(1.35)',
        }}>
          {Array.from({ length: 20 }, (_, i) => (
            <span key={i} style={{ fontSize: 34 }}>
              {['⚽', '🏆', '🥅', '🍔', '🍟'][i % 5]}
            </span>
          ))}
        </div>

        {/* Bandeirinhas verde/amarelo/azul no topo */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 4 }}>
          <svg viewBox="0 0 400 26" preserveAspectRatio="none" width="100%" height="26" xmlns="http://www.w3.org/2000/svg">
            <line x1="0" y1="5" x2="400" y2="5" stroke="rgba(255,255,255,0.45)" strokeWidth="1"/>
            {[16,48,80,112,144,176,208,240,272,304,336,368].map((x, i) => (
              <polygon
                key={i}
                points={`${x - 10},2 ${x + 10},2 ${x},20`}
                fill={['#0E8C4A', '#FFCC29', '#2A3F8F'][i % 3]}
                opacity="0.92"
              />
            ))}
          </svg>
        </div>

        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(10,14,22,0.3) 0%, rgba(10,14,22,0) 40%, rgba(10,14,22,0.4) 100%)',
        }} />

        <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 3 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 999,
            background: 'rgba(15,20,30,0.45)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 4C7.6 4 4 6.5 4 9.5h16C20 6.5 16.4 4 12 4z" fill="#fff" opacity="0.9"/>
              <rect x="3" y="11" width="18" height="2.5" rx="1.25" fill="#fff" opacity="0.9"/>
              <path d="M4 15.5h16v.5a3.5 3.5 0 01-3.5 3.5h-9A3.5 3.5 0 014 16v-.5z" fill="#fff" opacity="0.9"/>
            </svg>
          </div>
        </div>

        <div style={{ position: 'absolute', top: 60, left: 0, right: 0, textAlign: 'center', zIndex: 2 }}>
          <div style={{
            fontFamily: '"Pacifico", cursive',
            color: '#fff', fontSize: 40, lineHeight: 1,
            textShadow: '0 2px 12px rgba(0,0,0,0.4)',
          }}>
            Luizao Lanches
          </div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 6, fontWeight: 500 }}>
            lanches, porções e macarrão
          </div>
          {/* Selo Esquenta da Copa */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'linear-gradient(135deg, #0E8C4A, #0A6E3A)',
            color: '#FFCC29', fontSize: 12, fontWeight: 800,
            padding: '4px 14px', borderRadius: 999,
            marginTop: 10, letterSpacing: 0.5,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            ⚽ Esquenta da Copa
          </div>
        </div>
      </div>

      {/* ── Restaurant card ──────────────────────────────────── */}
      <div style={{
        background: '#fff',
        borderTopLeftRadius: 22, borderTopRightRadius: 22,
        marginTop: -22, position: 'relative', zIndex: 2,
        padding: '0 20px 14px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: -44, marginBottom: 8 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 999, background: '#fff',
            boxShadow: '0 4px 14px rgba(0,0,0,0.16)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            <img src="/icon.png" alt="Logo" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 999 }} />
          </div>
        </div>

        <h1 style={{
          margin: 0, fontSize: 22, fontWeight: 800,
          color: '#16202E', letterSpacing: -0.3, textAlign: 'center',
        }}>
          Luizão Lanches
        </h1>

        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #ECECEF' }}>
          {!storeOpen ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#DC2626', fontSize: 13.5, fontWeight: 600 }}>
              <AlertTriangle size={14} />
              Fechado — pedidos temporariamente suspensos
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#1F9E55', fontWeight: 700, fontSize: 13.5 }}>
                <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="#1F9E55"/></svg>
                Aberto
              </span>
              <span style={{ color: '#ECECEF' }}>·</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6B7280', fontSize: 13.5 }}>
                <Clock size={13} />
                ~{tempoEspera} min
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Faixa promo Copa ─────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(90deg, #0E8C4A 0%, #0A6E3A 100%)',
        color: '#FFCC29', textAlign: 'center',
        fontSize: 13, fontWeight: 800, padding: '9px 16px',
        letterSpacing: 0.3,
      }}>
        🏆 Pede antes do apito — entrega rápida pra você curtir o jogo!
      </div>

      {/* ── Destaques carousel ───────────────────────────────── */}
      {!loading && highlights.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h2 style={{
            margin: '0 0 10px', padding: '0 20px',
            fontSize: 19, fontWeight: 800, color: '#16202E', letterSpacing: -0.3,
          }}>
            Destaques
          </h2>
          <div
            className="no-scrollbar"
            style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 20px 6px' }}
          >
            {highlights.map((item) => {
              const s = CATEGORIA_META[item.categoria] ?? { emoji: '🍽️', tint: '#F0F0F0' }
              const isDisabled = !storeOpen || !item.disponivel
              return (
                <button
                  key={item.id}
                  onClick={(e) => !isDisabled && handleAdd(item, e)}
                  style={{
                    width: 120, flexShrink: 0, border: 'none',
                    background: 'none', padding: 0,
                    cursor: isDisabled ? 'default' : 'pointer', textAlign: 'left',
                    opacity: isDisabled ? 0.55 : 1,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <div style={{
                    width: 120, height: 120, borderRadius: 16, background: s.tint,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative', overflow: 'hidden',
                    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.04)',
                  }}>
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'radial-gradient(120% 90% at 30% 20%, rgba(255,255,255,0.55), transparent 60%)',
                    }} />
                    <span style={{
                      fontSize: 52, lineHeight: 1,
                      filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.12))',
                      position: 'relative',
                    }}>
                      {s.emoji}
                    </span>
                  </div>
                  <div style={{ marginTop: 6, paddingLeft: 2 }}>
                    <div style={{ fontWeight: 800, color: '#16202E', fontSize: 14 }}>
                      {formatBRL(item.preco)}
                    </div>
                    <div
                      style={{ color: '#16202E', fontSize: 12.5, marginTop: 2, fontWeight: 500, lineHeight: 1.2 }}
                      className="line-clamp-1"
                    >
                      {item.nome}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Esquenta da Copa ─────────────────────────────────── */}
      <div style={{ marginTop: 16, position: 'relative', overflow: 'hidden' }}>
        {/* Emojis de fundo */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.06, zIndex: 0,
          display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', placeItems: 'center',
          transform: 'rotate(-4deg) scale(1.2)',
        }}>
          {Array.from({ length: 18 }, (_, i) => (
            <span key={i} style={{ fontSize: 28 }}>
              {['⚽', '🏆', '🥅', '🎽', '📺', '🍔'][i % 6]}
            </span>
          ))}
        </div>

        <div style={{
          position: 'relative', zIndex: 1,
          background: 'linear-gradient(135deg, #0E8C4A 0%, #0A5C32 100%)',
          padding: '20px 24px',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>⚽</span>
            <div>
              <div style={{
                fontSize: 20, fontWeight: 900, color: '#FFCC29',
                letterSpacing: -0.3, lineHeight: 1.1,
              }}>
                Esquenta da Copa
              </div>
              <div style={{
                fontSize: 12.5, color: 'rgba(255,255,255,0.75)',
                fontWeight: 600, marginTop: 2,
              }}>
                Seu lanche pra chegar antes do apito!
              </div>
            </div>
          </div>

          {/* Pills decorativos */}
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {['🍔 Lanches', '🍟 Porções', '🍺 Cervejas'].map((label) => (
              <span key={label} style={{
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff', fontSize: 11.5, fontWeight: 700,
                padding: '3px 10px', borderRadius: 999, backdropFilter: 'blur(4px)',
              }}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Category nav (sticky trigger) ────────────────────── */}
      {!loading && !error && categorias.length > 0 && (() => {
        const activeMeta = activeCat ? (CATEGORIA_META[activeCat] ?? { emoji: '🍽️', tint: '#F0F0F0' }) : null
        return (
          <div style={{
            position: 'sticky', top: 0, zIndex: 20,
            background: '#fff',
            borderBottom: '1px solid #ECECEF',
            boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
            padding: '10px 16px',
          }}>
            <button
              onClick={() => setCatSheetOpen(true)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'linear-gradient(135deg, #F4581C 0%, #e04010 100%)',
                border: 'none', borderRadius: 14,
                padding: '12px 18px', cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                boxShadow: '0 4px 14px rgba(244,88,28,0.35)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{activeMeta?.emoji ?? '🍽️'}</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 600, lineHeight: 1 }}>
                    Navegando em
                  </div>
                  <div style={{ fontSize: 15, color: '#fff', fontWeight: 800, lineHeight: 1.3 }}>
                    {activeCat ?? 'Cardápio'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 700 }}>
                  Ver tudo
                </span>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="1" y="2" width="5" height="4" rx="1" fill="#fff"/>
                    <rect x="8" y="2" width="5" height="4" rx="1" fill="#fff"/>
                    <rect x="1" y="8" width="5" height="4" rx="1" fill="#fff"/>
                    <rect x="8" y="8" width="5" height="4" rx="1" fill="#fff"/>
                  </svg>
                </div>
              </div>
            </button>
          </div>
        )
      })()}

      {/* ── Category bottom sheet ─────────────────────────────── */}
      {catSheetOpen && (
        <>
          <div
            onClick={() => setCatSheetOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 40,
              background: 'rgba(0,0,0,0.45)',
              backdropFilter: 'blur(2px)',
            }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
            background: '#fff',
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: '0 0 32px',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
            maxHeight: '75vh', overflowY: 'auto',
          }}>
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: 40, height: 4, borderRadius: 999, background: '#E5E7EB' }} />
            </div>

            <div style={{ padding: '8px 20px 16px', borderBottom: '1px solid #F3F4F6' }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#16202E' }}>
                Categorias
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
              padding: '16px 16px 0',
            }}>
              {categorias.map((cat) => {
                const meta = CATEGORIA_META[cat] ?? { emoji: '🍽️', tint: '#F5F5F5' }
                const isActive = activeCat === cat
                return (
                  <button
                    key={cat}
                    onClick={() => { scrollToCategory(cat); setCatSheetOpen(false) }}
                    style={{
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      gap: 8, padding: '16px 8px',
                      borderRadius: 16,
                      border: isActive ? '2.5px solid #F4581C' : '2px solid transparent',
                      background: isActive ? '#FFF3EF' : meta.tint,
                      cursor: 'pointer',
                      WebkitTapHighlightColor: 'transparent',
                      transition: 'transform 0.1s',
                    }}
                  >
                    <span style={{ fontSize: 32, lineHeight: 1 }}>{meta.emoji}</span>
                    <span style={{
                      fontSize: 12.5, fontWeight: 700,
                      color: isActive ? '#F4581C' : '#374151',
                      textAlign: 'center', lineHeight: 1.2,
                    }}>
                      {cat}
                    </span>
                    {isActive && (
                      <div style={{
                        width: 6, height: 6, borderRadius: 999,
                        background: '#F4581C',
                      }} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Menu sections ────────────────────────────────────── */}
      <main style={{
        maxWidth: 680, margin: '0 auto',
        padding: '0 20px',
        paddingBottom: cartCount > 0 ? 110 : 40,
      }}>
        {loading && (
          <div className="text-center py-16 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 animate-pulse" />
            Carregando cardápio…
          </div>
        )}
        {error && (
          <div className="text-center py-12 text-destructive">{error}</div>
        )}
        {!loading && !error && categorias.map((cat) => (
          <div
            key={cat}
            ref={(el) => { catRefs.current[cat] = el }}
          >
            <h2 style={{
              margin: '22px 0 0',
              fontSize: 19, fontWeight: 800,
              color: '#16202E', letterSpacing: -0.3,
            }}>
              {cat}
            </h2>
            <CategorySection
              categoria={cat}
              itens={itens.filter((i) => i.categoria === cat)}
              onAdd={handleAdd}
              onRemove={handleRemove}
              storeOpen={storeOpen}
              cartQtys={cartQtys}
            />
          </div>
        ))}
      </main>

      {/* ── Floating cart bar ────────────────────────────────── */}
      {cartCount > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          zIndex: 30, padding: '0 16px 20px', pointerEvents: 'none',
        }}>
          <button
            id="copa-bagbar"
            onClick={() => setDrawerOpen(true)}
            style={{
              width: '100%', maxWidth: 640,
              display: 'flex', alignItems: 'center', gap: 12,
              margin: '0 auto', height: 56, borderRadius: 16,
              border: 'none', cursor: 'pointer',
              background: '#F4581C', color: '#fff',
              boxShadow: '0 8px 24px rgba(244,88,28,0.4)',
              padding: '0 18px', pointerEvents: 'auto',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{
              background: 'rgba(255,255,255,0.22)', minWidth: 28, height: 28,
              borderRadius: 8, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontWeight: 800, fontSize: 15,
            }}>
              {cartCount}
            </span>
            <span style={{ flex: 1, textAlign: 'left', fontWeight: 800, fontSize: 16 }}>
              Ver sacola
            </span>
            <span style={{ fontWeight: 800, fontSize: 16 }}>{formatBRL(cartTotal)}</span>
          </button>
        </div>
      )}

      <PhonePromptModal
        open={showPhonePrompt}
        onDone={() => setShowPhonePrompt(false)}
      />

      <ProductCustomizationModal
        item={customItem}
        open={!!customItem}
        onClose={() => setCustomItem(null)}
        onConfirm={handleCustomConfirm}
      />

      <CartDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSuccess={(result) => { setSuccessData(result); setShowSuccess(true) }}
        deliveryFee={fee}
      />

      <SuccessModal
        open={showSuccess}
        clienteName={successData?.nome ?? ''}
        phone={successData?.phone ?? ''}
        pedidoId={successData?.pedidoId ?? ''}
        tempoEspera={tempoEspera}
        tipoentrega={successData?.tipoentrega ?? 'retirada'}
        onClose={() => { setShowSuccess(false); setSuccessData(null) }}
      />
    </div>
  )
}
