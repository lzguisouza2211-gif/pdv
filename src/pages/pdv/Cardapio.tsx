import { useState, useRef, useEffect } from 'react'
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
import { ShoppingCart, Clock, AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react'
import { gerarCartKey } from '@/utils/pedido'
import { getClienteSession, hasSkippedPrompt } from '@/services/api/clientes.service'
import { formatBRL } from '@/utils/calc'

const CATEGORIA_ORDER = ['Lanches', 'Macarrão', 'Porções', 'Omeletes', 'Bebidas', 'Cervejas', 'Doces']
const CUSTOM_CATS = new Set(['Lanches', 'Macarrão', 'Omeletes'])

export function Cardapio() {
  const { itens, loading, error } = useCardapio()
  const { status } = useStoreStatus()
  const { fee } = useDeliveryFee()
  const { items: cartItems, add } = useCart()
  const [customItem, setCustomItem] = useState<ItemCardapio | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [successData, setSuccessData] = useState<CheckoutSuccess | null>(null)
  const [showPhonePrompt, setShowPhonePrompt] = useState(
    () => !getClienteSession() && !hasSkippedPrompt()
  )
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [catDropdownOpen, setCatDropdownOpen] = useState(false)
  const catRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const storeOpen = status?.is_open ?? true
  const tempoEspera = status?.tempo_espera_padrao ?? 30

  const categorias = CATEGORIA_ORDER.filter((cat) =>
    itens.some((i) => i.categoria === cat)
  )

  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0)
  const cartTotal = cartItems.reduce((s, i) => s + calcItemPrice(i) * i.qty, 0)

  // Rastreia qual categoria está visível para destacar o pill
  useEffect(() => {
    if (categorias.length === 0) return
    const observers: IntersectionObserver[] = []
    categorias.forEach((cat) => {
      const el = catRefs.current[cat]
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveCat(cat) },
        { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
      )
      obs.observe(el)
      observers.push(obs)
    })
    return () => observers.forEach((o) => o.disconnect())
  }, [categorias])

  // Mantém o pill ativo visível na barra de categorias
  useEffect(() => {
    if (!activeCat) return
    pillRefs.current[activeCat]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [activeCat])

  function scrollToCategory(cat: string) {
    catRefs.current[cat]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveCat(cat)
  }

  function handleAdd(item: ItemCardapio) {
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
    }
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
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-30 shadow-md">
        {/* Hero */}
        <div className="bg-primary text-primary-foreground px-4 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">🍔 Luizão Lanches</h1>
              <div className="flex items-center gap-1.5 text-primary-foreground/80 text-xs mt-0.5">
                {storeOpen ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-green-300" />
                    <span>Aberto · ~{tempoEspera} min</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3 w-3 text-red-300" />
                    <span>Fechado no momento</span>
                  </>
                )}
              </div>
            </div>
            {/* Cart button no header apenas como fallback desktop */}
            {cartCount > 0 && (
              <button
                onClick={() => setDrawerOpen(true)}
                className="hidden sm:flex items-center gap-2 bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground px-3 py-1.5 rounded-full text-sm font-semibold transition-colors"
              >
                <ShoppingCart className="h-4 w-4" />
                {cartCount} · {formatBRL(cartTotal)}
              </button>
            )}
          </div>
        </div>

        {!storeOpen && (
          <div className="bg-destructive text-destructive-foreground text-center py-2 text-xs flex items-center justify-center gap-1.5 font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            Loja fechada — pedidos temporariamente suspensos
          </div>
        )}

        {/* Category dropdown */}
        {!loading && !error && categorias.length > 0 && (
          <div className="bg-white border-b relative">
            <div className="max-w-5xl mx-auto px-4 py-2">
              <button
                onClick={() => setCatDropdownOpen((v) => !v)}
                className="flex items-center justify-between w-full bg-muted px-4 py-2.5 rounded-full text-sm font-semibold transition-colors hover:bg-muted/80"
              >
                <span className="flex items-center gap-2">
                  {activeCat ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      {activeCat}
                    </>
                  ) : (
                    'Categorias'
                  )}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${catDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {catDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setCatDropdownOpen(false)}
                  />
                  <div className="absolute left-4 right-4 top-full mt-1 z-20 bg-background border-2 rounded-2xl shadow-xl overflow-hidden">
                    {categorias.map((cat) => (
                      <button
                        key={cat}
                        ref={(el) => { pillRefs.current[cat] = el }}
                        onClick={() => { scrollToCategory(cat); setCatDropdownOpen(false) }}
                        className={`w-full text-left px-4 py-3 text-sm font-semibold transition-colors border-b last:border-0 flex items-center gap-3 ${
                          activeCat === cat
                            ? 'text-primary bg-primary/5'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        {activeCat === cat && (
                          <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                        <span className={activeCat === cat ? '' : 'ml-5'}>{cat}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 pb-28">
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
            className="mb-10 scroll-mt-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-extrabold tracking-tight">{cat}</h2>
              <div className="flex-1 h-px bg-border" />
            </div>
            <CategorySection
              categoria={cat}
              itens={itens.filter((i) => i.categoria === cat)}
              onAdd={handleAdd}
              storeOpen={storeOpen}
            />
          </div>
        ))}
      </main>

      {/* Barra flutuante do carrinho */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pointer-events-none">
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-full max-w-lg mx-auto flex items-center justify-between bg-primary text-primary-foreground px-4 py-3.5 rounded-2xl shadow-xl pointer-events-auto active:scale-[0.98] transition-all"
          >
            <span className="bg-primary-foreground/25 rounded-full w-7 h-7 flex items-center justify-center text-sm font-extrabold">
              {cartCount}
            </span>
            <span className="font-bold text-base">Ver carrinho</span>
            <span className="font-semibold text-primary-foreground/90">{formatBRL(cartTotal)}</span>
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
        clienteEncontrado={successData?.clienteEncontrado ?? null}
        nomeCliente={successData?.nome ?? ''}
        phoneCliente={successData?.phone ?? ''}
        totalPedido={successData?.total ?? 0}
        pedidoId={successData?.pedidoId ?? ''}
        onClose={() => { setShowSuccess(false); setSuccessData(null) }}
      />
    </div>
  )
}
