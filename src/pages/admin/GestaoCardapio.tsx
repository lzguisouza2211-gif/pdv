import { useState, useEffect } from 'react'
import { QuickMenuManagement } from '@/components/admin/QuickMenuManagement'
import { IngredientesIndisponiveisPanel } from '@/components/admin/IngredientesIndisponiveisPanel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ChevronDown } from 'lucide-react'
import { fetchDeliveryFee, updateDeliveryFee } from '@/services/api/deliveryFee.service'
import { formatBRL } from '@/utils/calc'

export function GestaoCardapio() {
  const [taxaEntrega, setTaxaEntrega] = useState<number>(5)
  const [taxaEdit, setTaxaEdit] = useState('')
  const [savingTaxa, setSavingTaxa] = useState(false)
  const [ingredientesOpen, setIngredientesOpen] = useState(false)

  useEffect(() => {
    fetchDeliveryFee().then(setTaxaEntrega).catch(console.error)
  }, [])

  async function handleSaveTaxa() {
    const val = parseFloat(taxaEdit.replace(',', '.'))
    if (isNaN(val) || val < 0) return
    setSavingTaxa(true)
    try {
      await updateDeliveryFee(val)
      setTaxaEntrega(val)
      setTaxaEdit('')
    } catch (err) {
      console.error(err)
    } finally {
      setSavingTaxa(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Taxa de Entrega</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-muted-foreground shrink-0">Atual: <span className="font-semibold">{formatBRL(taxaEntrega)}</span></p>
          <div className="flex gap-2 flex-1">
            <Label htmlFor="taxa" className="sr-only">Nova taxa</Label>
            <Input
              id="taxa"
              placeholder="Ex: 7.50"
              value={taxaEdit}
              onChange={(e) => setTaxaEdit(e.target.value)}
              className="flex-1 min-w-0"
            />
            <Button onClick={handleSaveTaxa} disabled={savingTaxa || !taxaEdit}>
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Disponibilidade e Preços</CardTitle>
        </CardHeader>
        <CardContent>
          <QuickMenuManagement />
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setIngredientesOpen((o) => !o)}
        >
          <CardTitle className="text-base flex items-center justify-between">
            Ingredientes Indisponíveis
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${ingredientesOpen ? 'rotate-180' : ''}`}
            />
          </CardTitle>
        </CardHeader>
        {ingredientesOpen && (
          <CardContent>
            <IngredientesIndisponiveisPanel />
          </CardContent>
        )}
      </Card>
    </div>
  )
}
