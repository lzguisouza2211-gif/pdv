import { useState, useRef } from 'react'
import { ItemCardapio, ExtraOption } from '@/types'
import { useCardapio } from '@/hooks/useCardapio'
import { useStoreStatus } from '@/hooks/useStoreStatus'
import { useDeliveryFee } from '@/hooks/useDeliveryFee'
import { useCart } from '@/store/useCart'
import { CategorySection } from '@/components/pdv/CategorySection'
import { ProductCustomizationModal } from '@/components/pdv/ProductCustomizationModal'
import { CartDrawer, CheckoutSuccess } from '@/components/pdv/CartDrawer'
import { SuccessModal } from '@/components/pdv/SuccessModal'
import { PhonePromptModal } from '@/components/pdv/PhonePromptModal'
import { Button } from '@/components/ui/button'
import { ShoppingCart, Clock, AlertTriangle } from 'lucide-react'
import { gerarCartKey } from '@/utils/pedido'
import { getClienteSession, hasSkippedPrompt } from '@/services/api/clientes.service'

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
  const catRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const storeOpen = status?.is_open ?? true
  const tempoEspera = status?.tempo_espera_padrao ?? 30

  const categorias = CATEGORIA_ORDER.filter((cat) =>
    itens.some((i) => i.categoria === cat)
  )

  function scrollToCategory(cat: string) {
    catRefs.current[cat]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

  function handleCustomConfirm(extras: ExtraOption[], observacoes: string) {
    if (!customItem) return
    const cartKey = gerarCartKey(customItem.id, extras, observacoes)
    add({
      cartKey,
      id: customItem.id,
      name: customItem.nome,
      price: customItem.preco,
      qty: 1,
      categoria: customItem.categoria,
      observacoes,
      extras,
    })
  }

  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-primary">Luizão Lanches</h1>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Tempo estimado: ~{tempoEspera} min</span>
            </div>
          </div>
          <Button
            onClick={() => setDrawerOpen(true)}
            className="relative"
            disabled={cartCount === 0}
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
            <span className="ml-1 hidden sm:inline">Carrinho</span>
          </Button>
        </div>

        {!storeOpen && (
          <div className="bg-destructive text-destructive-foreground text-center py-2 text-sm flex items-center justify-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Loja fechada no momento
          </div>
        )}

        {/* Category pills */}
        {!loading && !error && categorias.length > 0 && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-2 pt-1 scrollbar-none border-t">
            {categorias.map(cat => (
              <button
                key={cat}
                onClick={() => scrollToCategory(cat)}
                className="flex-none px-4 py-1 rounded-full border text-sm font-medium transition-colors whitespace-nowrap hover:bg-primary hover:text-primary-foreground"
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading && (
          <div className="text-center py-12 text-muted-foreground">Carregando cardápio…</div>
        )}
        {error && (
          <div className="text-center py-12 text-destructive">{error}</div>
        )}
        {!loading && !error && categorias.map((cat) => (
          <div key={cat} ref={el => { catRefs.current[cat] = el }} className="mb-8 scroll-mt-4">
            <h2 className="text-lg font-bold mb-3 px-1">{cat}</h2>
            <CategorySection
              categoria={cat}
              itens={itens.filter((i) => i.categoria === cat)}
              onAdd={handleAdd}
              storeOpen={storeOpen}
            />
          </div>
        ))}
      </main>

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
