import { useState, useEffect, useCallback } from 'react'
import { Pedido, PedidoStatus } from '@/types'
import { fetchPedidos } from '@/services/api/pedidos.service'
import { supabase } from '@/services/supabaseClient'
import { useStoreStatus } from '@/hooks/useStoreStatus'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PrintButton } from '@/components/admin/PrintButton'
import { formatBRL } from '@/utils/calc'
import { format, differenceInMinutes } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Eye, Phone, Clock, AlertTriangle } from 'lucide-react'

const STATUS_COLORS: Record<PedidoStatus, string> = {
  Recebido: 'bg-yellow-100 text-yellow-800',
  'Em preparo': 'bg-blue-100 text-blue-800',
  Finalizado: 'bg-green-100 text-green-800',
  Cancelado: 'bg-red-100 text-red-800',
}

const ACTIVE_STATUSES: PedidoStatus[] = ['Recebido', 'Em preparo']

const today = new Date().toISOString().split('T')[0]

// Tick global: atualiza a cada 30s para manter os timers vivos
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function OrderTimer({ createdAt, tempoEsperaMin }: { createdAt: string; tempoEsperaMin: number }) {
  const now = useNow()
  const elapsed = differenceInMinutes(now, new Date(createdAt))
  const ratio = Math.min(elapsed / tempoEsperaMin, 1)
  const atrasado = elapsed > tempoEsperaMin
  const atrasoMin = elapsed - tempoEsperaMin

  const barColor = atrasado
    ? 'bg-red-500'
    : ratio >= 0.6
    ? 'bg-amber-400'
    : 'bg-green-500'

  const textColor = atrasado
    ? 'text-red-600'
    : ratio >= 0.6
    ? 'text-amber-600'
    : 'text-green-700'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className={`flex items-center gap-1 font-medium ${textColor}`}>
          {atrasado ? (
            <><AlertTriangle className="h-3 w-3" /> Atrasado {atrasoMin} min</>
          ) : (
            <><Clock className="h-3 w-3" /> {elapsed} min</>
          )}
        </span>
        <span className="text-muted-foreground">
          {atrasado ? `${elapsed}` : `${elapsed}`}/{tempoEsperaMin} min
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
          style={{ width: `${Math.min(ratio * 100, 100)}%` }}
        />
      </div>
    </div>
  )
}

export function Pedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [pedidoVisualizando, setPedidoVisualizando] = useState<Pedido | null>(null)
  const { status: storeStatus } = useStoreStatus()

  const tempoEspera = storeStatus?.tempo_espera_padrao ?? 30

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchPedidos({
        startDate,
        endDate,
        status: statusFilter !== 'todos' ? (statusFilter as PedidoStatus) : undefined,
      })
      setPedidos(data)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, statusFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const channel = supabase
      .channel('pedidos-admin-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos' }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
        <div>
          <Label htmlFor="start">De</Label>
          <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full" />
        </div>
        <div>
          <Label htmlFor="end">Até</Label>
          <Input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full" />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <Label>Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="Recebido">Recebido</SelectItem>
              <SelectItem value="Em preparo">Em preparo</SelectItem>
              <SelectItem value="Finalizado">Finalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Indicador de tempo de espera configurado */}
      {storeStatus && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Tempo de espera configurado: <span className="font-semibold">{tempoEspera} min</span>
        </p>
      )}

      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      )}

      <div className="space-y-3">
        {pedidos.map((p) => {
          const isActive = ACTIVE_STATUSES.includes(p.status)
          return (
            <Card key={p.id} className={isActive ? 'border-l-4 border-l-primary/50' : ''}>
              <CardContent className="pt-4 space-y-3">
                {/* Linha 1: ID + horário + status + valor */}
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">#{p.id}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(p.created_at), "HH:mm", { locale: ptBR })}
                    </span>
                    <Badge className={`${STATUS_COLORS[p.status]} text-xs`}>{p.status}</Badge>
                  </div>
                  <span className="font-bold text-primary">{formatBRL(p.total)}</span>
                </div>

                {/* Linha 2: cliente + telefone */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <span className="font-medium">{p.cliente}</span>
                  {p.phone && (
                    <span className="flex items-center gap-1 text-muted-foreground text-xs">
                      <Phone className="h-3 w-3" />{p.phone}
                    </span>
                  )}
                </div>

                {/* Linha 3: itens */}
                <div className="text-sm text-muted-foreground leading-relaxed">
                  {p.itens.map((item, i) => (
                    <span key={i}>{item.quantidade} {item.nome}{i < p.itens.length - 1 ? ' · ' : ''}</span>
                  ))}
                </div>

                {/* Timer — só para pedidos ativos */}
                {isActive && (
                  <OrderTimer createdAt={p.created_at} tempoEsperaMin={tempoEspera} />
                )}

                {/* Ações */}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => setPedidoVisualizando(p)}>
                    <Eye className="h-3.5 w-3.5 mr-1" /> Visualizar
                  </Button>
                  <PrintButton pedido={p} />
                </div>
              </CardContent>
            </Card>
          )
        })}

        {!loading && pedidos.length === 0 && (
          <p className="text-muted-foreground text-center py-8">Nenhum pedido encontrado</p>
        )}
      </div>

      {/* Modal de visualização */}
      <Dialog open={!!pedidoVisualizando} onOpenChange={(o) => { if (!o) setPedidoVisualizando(null) }}>
        <DialogContent className="max-w-md max-h-[85dvh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle>Pedido #{pedidoVisualizando?.id}</DialogTitle>
          </DialogHeader>
          {pedidoVisualizando && (
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              <div className="flex flex-wrap gap-2 items-center">
                <Badge className={STATUS_COLORS[pedidoVisualizando.status]}>{pedidoVisualizando.status}</Badge>
                <span className="text-sm text-muted-foreground">
                  {format(new Date(pedidoVisualizando.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
              </div>

              <div className="space-y-1 text-sm">
                <p><span className="font-medium">Cliente:</span> {pedidoVisualizando.cliente}</p>
                {pedidoVisualizando.phone && (
                  <p className="flex items-center gap-1.5">
                    <span className="font-medium">Telefone:</span>
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    {pedidoVisualizando.phone}
                  </p>
                )}
                <p><span className="font-medium">Pagamento:</span> {pedidoVisualizando.formapagamento}</p>
                {pedidoVisualizando.tipoentrega === 'entrega' && pedidoVisualizando.endereco && (
                  <p>
                    <span className="font-medium">Endereço:</span>{' '}
                    {pedidoVisualizando.endereco}
                    {pedidoVisualizando.numero ? `, ${pedidoVisualizando.numero}` : ''}
                    {pedidoVisualizando.bairro ? ` — ${pedidoVisualizando.bairro}` : ''}
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Itens</p>
                <div className="space-y-2">
                  {pedidoVisualizando.itens.map((item, i) => (
                    <div key={i} className="border rounded-md p-2.5 text-sm">
                      <div className="flex justify-between font-medium">
                        <span>{item.quantidade} {item.nome}</span>
                        <span className="text-primary">{formatBRL(item.preco * item.quantidade)}</span>
                      </div>
                      {item.adicionais && item.adicionais.length > 0 && (
                        <p className="text-xs text-green-700 mt-0.5">
                          + {item.adicionais.map(a => (a.qty ?? 1) > 1 ? `${a.qty}x ${a.nome}` : a.nome).join(', ')}
                        </p>
                      )}
                      {item.retirados && item.retirados.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Sem: {item.retirados.map(r => r.nome).join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between font-bold border-t pt-3">
                <span>Total</span>
                <span className="text-primary text-lg">{formatBRL(pedidoVisualizando.total)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
