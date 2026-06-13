import { useState } from 'react'
import { QuickMenuManagement } from '@/components/admin/QuickMenuManagement'
import { IngredientesIndisponiveisPanel } from '@/components/admin/IngredientesIndisponiveisPanel'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { UtensilsCrossed, AlertTriangle } from 'lucide-react'

export function GestaoCardapio() {
  const [tab, setTab] = useState('produtos')

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
          <TabsTrigger value="ingredientes" className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" /> Ingredientes indisponíveis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="mt-4">
          <QuickMenuManagement />
        </TabsContent>

        <TabsContent value="ingredientes" className="mt-4">
          <IngredientesIndisponiveisPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
