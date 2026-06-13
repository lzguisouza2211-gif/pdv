import { useState, useEffect } from 'react'
import { usePedidos } from '@/hooks/usePedidos'
import { useStoreStatus } from '@/hooks/useStoreStatus'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { updateStoreOpen, updateTempoEspera, fetchPixConfig, updatePixConfig } from '@/services/api/storeStatus.service'
import { fetchDeliveryFee, updateDeliveryFee } from '@/services/api/deliveryFee.service'
import { formatBRL } from '@/utils/calc'
import { toast } from '@/hooks/use-toast'
import { ShoppingBag, DollarSign, TrendingUp, Clock, QrCode, Truck } from 'lucide-react'

type PixKeyType = 'cpf' | 'cnpj' | 'celular' | 'email' | 'aleatoria'

function applyPixMask(value: string, type: PixKeyType): string {
  if (type === 'email' || type === 'aleatoria') return value

  const d = value.replace(/\D/g, '')

  if (type === 'cpf') {
    const s = d.slice(0, 11)
    if (s.length <= 3) return s
    if (s.length <= 6) return `${s.slice(0, 3)}.${s.slice(3)}`
    if (s.length <= 9) return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6)}`
    return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9)}`
  }

  if (type === 'cnpj') {
    const s = d.slice(0, 14)
    if (s.length <= 2) return s
    if (s.length <= 5) return `${s.slice(0, 2)}.${s.slice(2)}`
    if (s.length <= 8) return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5)}`
    if (s.length <= 12) return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8)}`
    return `${s.slice(0, 2)}.${s.slice(2, 5)}.${s.slice(5, 8)}/${s.slice(8, 12)}-${s.slice(12)}`
  }

  if (type === 'celular') {
    const s = d.slice(0, 11)
    if (s.length === 0) return ''
    if (s.length <= 2) return `(${s}`
    if (s.length <= 6) return `(${s.slice(0, 2)}) ${s.slice(2)}`
    if (s.length <= 10) return `(${s.slice(0, 2)}) ${s.slice(2, 6)}-${s.slice(6)}`
    return `(${s.slice(0, 2)}) ${s.slice(2, 7)}-${s.slice(7)}`
  }

  return value
}

function getRawPixKey(masked: string, type: PixKeyType): string {
  if (type === 'email' || type === 'aleatoria') return masked.trim()
  return masked.replace(/\D/g, '')
}

function detectPixType(raw: string): PixKeyType {
  if (!raw) return 'cpf'
  if (raw.includes('@')) return 'email'
  const d = raw.replace(/\D/g, '')
  if (d.length === 14) return 'cnpj'
  if (d.length === 10) return 'celular'
  if (d.length === 11) return d[2] === '9' ? 'celular' : 'cpf'
  return 'aleatoria'
}

const PIX_TYPE_LABELS: Record<PixKeyType, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  celular: 'Celular',
  email: 'E-mail',
  aleatoria: 'Chave aleatória',
}

const PIX_TYPE_PLACEHOLDERS: Record<PixKeyType, string> = {
  cpf: '000.000.000-00',
  cnpj: '00.000.000/0000-00',
  celular: '(00) 00000-0000',
  email: 'exemplo@email.com',
  aleatoria: 'Cole a chave aleatória',
}

export function Dashboard() {
  const { pedidos } = usePedidos()
  const { status, reload: reloadStatus } = useStoreStatus()

  const [tempoEdit, setTempoEdit] = useState('')
  const [savingTempo, setSavingTempo] = useState(false)

  const [pixKeyType, setPixKeyType] = useState<PixKeyType>('cpf')
  const [pixKey, setPixKey] = useState('')
  const [pixRecipient, setPixRecipient] = useState('')
  const [savingPix, setSavingPix] = useState(false)

  const [taxaEntrega, setTaxaEntrega] = useState<number>(0)
  const [taxaEdit, setTaxaEdit] = useState('')
  const [savingTaxa, setSavingTaxa] = useState(false)

  const pedidosDoDia = pedidos.filter((p) => p.status !== 'Cancelado')
  const faturamento = pedidosDoDia.reduce((s, p) => s + p.total, 0)
  const ticketMedio = pedidosDoDia.length > 0 ? faturamento / pedidosDoDia.length : 0

  useEffect(() => {
    fetchPixConfig().then((config) => {
      if (config) {
        const type = detectPixType(config.key)
        setPixKeyType(type)
        setPixKey(applyPixMask(config.key, type))
        setPixRecipient(config.recipientName)
      }
    })
    fetchDeliveryFee().then(setTaxaEntrega).catch(() => {})
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

  async function handleSaveTaxa() {
    const val = parseFloat(taxaEdit.replace(',', '.'))
    if (isNaN(val) || val < 0) return
    setSavingTaxa(true)
    try {
      await updateDeliveryFee(val)
      setTaxaEntrega(val)
      setTaxaEdit('')
      toast({ title: 'Taxa de entrega atualizada!' })
    } catch (err: unknown) {
      const e = err as { message?: string }
      toast({ title: 'Erro ao salvar taxa', description: e?.message, variant: 'destructive' })
    } finally {
      setSavingTaxa(false)
    }
  }

  async function handleSavePix() {
    if (!pixKey.trim()) return
    setSavingPix(true)
    const rawKey = getRawPixKey(pixKey, pixKeyType)
    try {
      await updatePixConfig({
        key: rawKey,
        displayKey: pixKey.trim(),
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
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
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
              <Truck className="h-4 w-4" /> Taxa de entrega
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Atual: <span className="font-semibold text-foreground">{formatBRL(taxaEntrega)}</span>
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Ex: 7.50"
                value={taxaEdit}
                onChange={(e) => setTaxaEdit(e.target.value)}
                className="flex-1 min-w-0"
              />
              <Button onClick={handleSaveTaxa} disabled={savingTaxa || !taxaEdit}>
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="h-4 w-4" /> Chave PIX
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Select
              value={pixKeyType}
              onValueChange={(v) => {
                setPixKeyType(v as PixKeyType)
                setPixKey('')
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo de chave" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PIX_TYPE_LABELS) as PixKeyType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {PIX_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder={PIX_TYPE_PLACEHOLDERS[pixKeyType]}
              value={pixKey}
              onChange={(e) => setPixKey(applyPixMask(e.target.value, pixKeyType))}
              inputMode={pixKeyType === 'email' || pixKeyType === 'aleatoria' ? 'text' : 'numeric'}
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
