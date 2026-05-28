import { usePedidos } from '@/hooks/usePedidos'
import { OrderMonitor } from '@/components/admin/OrderMonitor'

export function KanbanPedidos() {
  const { pedidos, reload } = usePedidos()
  const pedidosDoDia = pedidos.filter((p) => p.status !== 'Cancelado')

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Pedidos do Dia</h2>
        <span className="text-sm text-muted-foreground">
          {pedidosDoDia.length} pedido{pedidosDoDia.length !== 1 ? 's' : ''}
        </span>
      </div>
      <OrderMonitor pedidos={pedidosDoDia} onUpdate={reload} />
    </div>
  )
}
