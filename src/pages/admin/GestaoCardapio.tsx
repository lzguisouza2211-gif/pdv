import { useState } from 'react'
import { QuickMenuManagement } from '@/components/admin/QuickMenuManagement'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { fetchDeliveryFee, updateDeliveryFee } from '@/services/api/deliveryFee.service'
import { formatBRL } from '@/utils/calc'
import { useEffect } from 'react'

export function GestaoCardapio() {
  const [taxaEntrega, setTaxaEntrega] = useState<number>(5)
  const [taxaEdit, setTaxaEdit] = useState('')
  const [savingTaxa, setSavingTaxa] = useState(false)

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
        <CardContent className="flex items-center gap-4">
          <p className="text-muted-foreground">Atual: <span className="font-semibold">{formatBRL(taxaEntrega)}</span></p>
          <div className="flex gap-2">
            <div>
              <Label htmlFor="taxa" className="sr-only">Nova taxa</Label>
              <Input
                id="taxa"
                placeholder="Ex: 7.50"
                value={taxaEdit}
                onChange={(e) => setTaxaEdit(e.target.value)}
                className="w-32"
              />
            </div>
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
    </div>
  )
}
