import { useState, useEffect, useCallback } from 'react'
import { Pedido, PedidoStatus } from '@/types'
import { fetchPedidos } from '@/services/api/pedidos.service'
import { supabase } from '@/services/supabaseClient'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { PrintButton } from '@/components/admin/PrintButton'
import { formatBRL } from '@/utils/calc'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Eye } from 'lucide-react'

const STATUS_COLORS: Record<PedidoStatus, string> = {
  Recebido: 'bg-yellow-100 text-yellow-800',
  'Em preparo': 'bg-blue-100 text-blue-800',
  Finalizado: 'bg-green-100 text-green-800',
  Cancelado: 'bg-red-100 text-red-800',
}

const today = new Date().toISOString().split('T')[0]

export function Pedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [pedidoVisualizando, setPedidoVisualizando] = useState<Pedido | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchPedidos({
        startDate,
        endDate,
        status: statusFilter !== 'todos' ? (statusFilter as PedidoStatus) : undefined,
      })
      setPedidos(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, statusFilter])

  useEffect(() => {
    load()
  }, [load])

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

      {loading && <p className="text-muted-foreground">Carregando…</p>}

      <div className="space-y-3">
        {pedidos.map((p) => (
          <Card key={p.id}>
            <CardContent className="pt-4 space-y-2">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold">#{p.id}</span>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(p.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                  <Badge className={STATUS_COLORS[p.status]}>{p.status}</Badge>
                </div>
                <span className="font-bold text-primary">{formatBRL(p.total)}</span>
              </div>
              <p className="text-sm"><span className="font-medium">{p.cliente}</span> — {p.phone}</p>
              <div className="text-sm space-y-0.5">
                {p.itens.map((item, i) => (
                  <span key={i} className="text-muted-foreground">
                    {item.quantidade}x {item.nome}{' '}
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPedidoVisualizando(p)}>
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  Visualizar
                </Button>
                <PrintButton pedido={p} />
              </div>
            </CardContent>
          </Card>
        ))}
        {!loading && pedidos.length === 0 && (
          <p className="text-muted-foreground text-center py-8">Nenhum pedido encontrado</p>
        )}
      </div>

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
                  <p><span className="font-medium">Telefone:</span> {pedidoVisualizando.phone}</p>
                )}
                <p><span className="font-medium">Pagamento:</span> {pedidoVisualizando.formapagamento}</p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Itens</p>
                <div className="space-y-2">
                  {pedidoVisualizando.itens.map((item, i) => (
                    <div key={i} className="border rounded-md p-2.5 text-sm">
                      <div className="flex justify-between font-medium">
                        <span>{item.quantidade}x {item.nome}</span>
                        <span className="text-primary">{formatBRL(item.preco * item.quantidade)}</span>
                      </div>
                      {item.adicionais && item.adicionais.length > 0 && (
                        <p className="text-xs text-green-700 mt-0.5">+ {item.adicionais.map(a => (a.qty ?? 1) > 1 ? `${a.qty}x ${a.nome}` : a.nome).join(', ')}</p>
                      )}
                      {item.retirados && item.retirados.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">Sem: {item.retirados.map(r => r.nome).join(', ')}</p>
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
