import { useState, useEffect } from 'react'
import { usePedidos } from '@/hooks/usePedidos'
import { useStoreStatus } from '@/hooks/useStoreStatus'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { updateStoreOpen, updateTempoEspera, fetchPixConfig, updatePixConfig } from '@/services/api/storeStatus.service'
import { formatBRL } from '@/utils/calc'
import { toast } from '@/hooks/use-toast'
import { ShoppingBag, DollarSign, TrendingUp, Clock, QrCode } from 'lucide-react'

export function Dashboard() {
  const { pedidos } = usePedidos()
  const { status, reload: reloadStatus } = useStoreStatus()

  const [tempoEdit, setTempoEdit] = useState('')
  const [savingTempo, setSavingTempo] = useState(false)

  const [pixKey, setPixKey] = useState('')
  const [pixDisplay, setPixDisplay] = useState('')
  const [pixRecipient, setPixRecipient] = useState('')
  const [savingPix, setSavingPix] = useState(false)

  const pedidosDoDia = pedidos.filter((p) => p.status !== 'Cancelado')
  const faturamento = pedidosDoDia.reduce((s, p) => s + p.total, 0)
  const ticketMedio = pedidosDoDia.length > 0 ? faturamento / pedidosDoDia.length : 0

  useEffect(() => {
    fetchPixConfig().then((config) => {
      if (config) {
        setPixKey(config.key)
        setPixDisplay(config.displayKey)
        setPixRecipient(config.recipientName)
      }
    })
  }, [])

  async function handleToggleStore(checked: boolean) {
    try {
      await updateStoreOpen(checked)
      reloadStatus()
    } catch (err: unknown) {
      const e = err as { message?: string }
      toast({ title: 'Erro ao atualizar status', description: e?.message, variant: 'destructive' })
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
      toast({ title: 'Tempo de espera atualizado!' })
    } catch (err: unknown) {
      const e = err as { message?: string }
      toast({ title: 'Erro ao salvar', description: e?.message, variant: 'destructive' })
    } finally {
      setSavingTempo(false)
    }
  }

  async function handleSavePix() {
    if (!pixKey.trim()) return
    setSavingPix(true)
    try {
      await updatePixConfig({
        key: pixKey.trim(),
        displayKey: pixDisplay.trim() || pixKey.trim(),
        recipientName: pixRecipient.trim(),
      })
      toast({ title: 'Chave PIX salva!' })
    } catch (err: unknown) {
      const e = err as { message?: string }
      toast({
        title: 'Erro ao salvar PIX',
        description: e?.message?.includes('column')
          ? 'Adicione as colunas pix_key, pix_display_key, pix_recipient_name na tabela store_status do Supabase.'
          : e?.message,
        variant: 'destructive',
      })
    } finally {
      setSavingPix(false)
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
          <CardContent>
            <p className="text-2xl font-bold">{status?.tempo_espera_padrao ?? '—'} min</p>
          </CardContent>
        </Card>
      </div>

      {/* Controles */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status da Loja</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Switch checked={status?.is_open ?? true} onCheckedChange={handleToggleStore} />
            <Label className="text-base">{status?.is_open ? '🟢 Aberta' : '🔴 Fechada'}</Label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Tempo de espera
            </CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input
              type="number"
              placeholder={`Atual: ${status?.tempo_espera_padrao ?? 30} min`}
              value={tempoEdit}
              onChange={(e) => setTempoEdit(e.target.value)}
              className="flex-1 min-w-0"
            />
            <Button onClick={handleSaveTempo} disabled={savingTempo || !tempoEdit}>
              Salvar
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="h-4 w-4" /> Chave PIX
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input
              placeholder="Chave (CNPJ, CPF, e-mail…)"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
            />
            <Input
              placeholder="Chave formatada (exibição)"
              value={pixDisplay}
              onChange={(e) => setPixDisplay(e.target.value)}
            />
            <Input
              placeholder="Nome do recebedor"
              value={pixRecipient}
              onChange={(e) => setPixRecipient(e.target.value)}
            />
            <Button onClick={handleSavePix} disabled={savingPix || !pixKey.trim()} className="w-full">
              Salvar PIX
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
