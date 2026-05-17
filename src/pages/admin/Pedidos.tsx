import { useState, useEffect } from 'react'
import { Pedido, PedidoStatus } from '@/types'
import { fetchPedidos } from '@/services/api/pedidos.service'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PrintButton } from '@/components/admin/PrintButton'
import { formatBRL } from '@/utils/calc'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STATUS_COLORS: Record<PedidoStatus, string> = {
  Recebido: 'bg-yellow-100 text-yellow-800',
  'Em preparo': 'bg-blue-100 text-blue-800',
  Finalizado: 'bg-green-100 text-green-800',
}

const today = new Date().toISOString().split('T')[0]

export function Pedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [statusFilter, setStatusFilter] = useState<string>('todos')

  useEffect(() => {
    load()
  }, [startDate, endDate, statusFilter])

  async function load() {
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
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <Label htmlFor="start">De</Label>
          <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
        </div>
        <div>
          <Label htmlFor="end">Até</Label>
          <Input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
        </div>
        <div className="w-44">
          <Label>Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
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
                <PrintButton pedido={p} tipo="producao" />
                <PrintButton pedido={p} tipo="motoboy" />
              </div>
            </CardContent>
          </Card>
        ))}
        {!loading && pedidos.length === 0 && (
          <p className="text-muted-foreground text-center py-8">Nenhum pedido encontrado</p>
        )}
      </div>
    </div>
  )
}
