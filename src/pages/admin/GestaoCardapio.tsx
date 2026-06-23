import { useState } from 'react'
import { QuickMenuManagement } from '@/components/admin/QuickMenuManagement'
import { IngredientesIndisponiveisPanel } from '@/components/admin/IngredientesIndisponiveisPanel'
import { CadastroProdutoTab } from '@/components/admin/CadastroProdutoTab'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { UtensilsCrossed, AlertTriangle, PlusSquare } from 'lucide-react'

export function GestaoCardapio() {
  const [tab, setTab] = useState('produtos')
  const [reloadSignal, setReloadSignal] = useState(0)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Cardápio</h2>
        <p className="text-sm text-muted-foreground">Gerencie disponibilidade, preços e ingredientes</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="produtos" className="flex items-center gap-1.5">
            <UtensilsCrossed className="h-4 w-4" /> Produtos
          </TabsTrigger>
          <TabsTrigger value="cadastro" className="flex items-center gap-1.5">
            <PlusSquare className="h-4 w-4" /> Cadastrar produto
          </TabsTrigger>
          <TabsTrigger value="ingredientes" className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" /> Ingredientes indisponíveis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="mt-4">
          <QuickMenuManagement reloadSignal={reloadSignal} />
        </TabsContent>

        <TabsContent value="cadastro" className="mt-4">
          <CadastroProdutoTab
            onCreated={() => {
              setReloadSignal((s) => s + 1)
              setTab('produtos')
            }}
          />
        </TabsContent>

        <TabsContent value="ingredientes" className="mt-4">
          <IngredientesIndisponiveisPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
