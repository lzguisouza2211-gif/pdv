import { usePedidos } from '@/hooks/usePedidos'
import { useStoreStatus } from '@/hooks/useStoreStatus'
import { OrderMonitor } from '@/components/admin/OrderMonitor'
import { IngredientesIndisponiveisPanel } from '@/components/admin/IngredientesIndisponiveisPanel'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { updateStoreOpen, updateTempoEspera } from '@/services/api/storeStatus.service'
import { formatBRL } from '@/utils/calc'
import { useState } from 'react'
import { ShoppingBag, DollarSign, TrendingUp, Clock } from 'lucide-react'

export function Dashboard() {
  const { pedidos, reload } = usePedidos()
  const { status, reload: reloadStatus } = useStoreStatus()
  const [tempoEdit, setTempoEdit] = useState('')
  const [savingTempo, setSavingTempo] = useState(false)

  const pedidosDoDia = pedidos
  const faturamento = pedidosDoDia.reduce((s, p) => s + p.total, 0)
  const ticketMedio = pedidosDoDia.length > 0 ? faturamento / pedidosDoDia.length : 0

  async function handleToggleStore(checked: boolean) {
    try {
      await updateStoreOpen(checked)
      reloadStatus()
    } catch (err) {
      console.error(err)
    }
  }

  async function handleSaveTempo() {
    const val = parseInt(tempoEdit)
    if (isNaN(val) || val <= 0) return
    setSavingTempo(true)
    try {
      await updateTempoEspera(val)
      setTempoEdit('')
      reloadStatus()
    } catch (err) {
      console.error(err)
    } finally {
      setSavingTempo(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <ShoppingBag className="h-4 w-4" /> Pedidos hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pedidosDoDia.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-4 w-4" /> Faturamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{formatBRL(faturamento)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-4 w-4" /> Ticket médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatBRL(ticketMedio)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4" /> Tempo espera
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <p className="text-2xl font-bold">{status?.tempo_espera_padrao ?? '—'} min</p>
          </CardContent>
        </Card>
      </div>

      {/* Controles */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status da Loja</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Switch
              checked={status?.is_open ?? true}
              onCheckedChange={handleToggleStore}
            />
            <Label>{status?.is_open ? 'Aberta' : 'Fechada'}</Label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tempo de espera (min)</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input
              type="number"
              placeholder={String(status?.tempo_espera_padrao ?? 30)}
              value={tempoEdit}
              onChange={(e) => setTempoEdit(e.target.value)}
              className="flex-1 min-w-0"
            />
            <Button onClick={handleSaveTempo} disabled={savingTempo || !tempoEdit}>
              Salvar
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Ingredientes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ingredientes Indisponíveis</CardTitle>
        </CardHeader>
        <CardContent>
          <IngredientesIndisponiveisPanel />
        </CardContent>
      </Card>

      {/* Monitor de pedidos */}
      <div>
        <h2 className="text-xl font-bold mb-4">Pedidos do Dia</h2>
        <OrderMonitor pedidos={pedidosDoDia} onUpdate={reload} />
      </div>
    </div>
  )
}
