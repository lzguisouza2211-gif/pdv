import { useState } from 'react'
import { Pedido, PedidoStatus, FormaPagamento } from '@/types'
import { avancarStatus } from '@/services/api/pedidos.service'
import { notificarStatusPedido } from '@/services/whatsapp.service'
import { useToast } from '@/hooks/use-toast'
import { formatBRL } from '@/utils/calc'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PrintButton } from './PrintButton'
import { EditarPedidoModal } from './EditarPedidoModal'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Pencil, ChevronDown, ChevronUp } from 'lucide-react'

const PAGAMENTO_LABEL: Record<FormaPagamento, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao: 'Cartão',
}

const ENTREGA_LABEL: Record<string, string> = {
  retirada: 'Retirada',
  entrega: 'Delivery',
  local: 'Mesa',
}

const NEXT_LABEL: Partial<Record<PedidoStatus, string>> = {
  Recebido: 'Iniciar preparo',
  'Em preparo': 'Finalizar',
}

interface ColDef {
  status: PedidoStatus
  label: string
  color: string
  headerCls: string
}

const COLUMNS: ColDef[] = [
  {
    status: 'Recebido',
    label: 'Recebido',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    headerCls: 'border-yellow-400 bg-yellow-50',
  },
  {
    status: 'Em preparo',
    label: 'Em Preparo',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    headerCls: 'border-blue-400 bg-blue-50',
  },
  {
    status: 'Finalizado',
    label: 'Finalizado',
    color: 'bg-green-100 text-green-800 border-green-300',
    headerCls: 'border-green-400 bg-green-50',
  },
]

interface Props {
  pedidos: Pedido[]
  onUpdate: () => void
}

export function OrderMonitor({ pedidos, onUpdate }: Props) {
  const [editando, setEditando] = useState<Pedido | null>(null)
  const [finalizadosAbertos, setFinalizadosAbertos] = useState(false)
  const { toast } = useToast()

  async function handleAvancar(pedido: Pedido) {
    try {
      await avancarStatus(pedido)
      onUpdate()
      const wppStatus =
        pedido.status === 'Recebido' ? 'preparing'
        : pedido.status === 'Em preparo'
          ? (pedido.tipoentrega === 'entrega' ? 'out_for_delivery' : 'ready_for_pickup')
          : null
      if (wppStatus) {
        const result = await notificarStatusPedido({
          phone: pedido.phone,
          customerName: pedido.cliente,
          orderId: String(pedido.id),
          status: wppStatus,
          total: pedido.total,
        })
        if (result.ok) {
          toast({ title: '✅ WhatsApp enviado', description: `Notificação enviada para ${pedido.cliente}` })
        } else {
          toast({ title: '⚠️ WhatsApp não enviado', description: result.error, variant: 'destructive' })
        }
      }
    } catch (err) {
    }
  }

  function renderCard(p: Pedido) {
    const nextLabel = NEXT_LABEL[p.status]
    const hora = format(new Date(p.created_at), 'HH:mm', { locale: ptBR })
    const entregaLabel = ENTREGA_LABEL[p.tipoentrega] ?? p.tipoentrega

    return (
      <div
        key={p.id}
        className="border rounded-xl p-3 space-y-2 bg-card shadow-sm hover:shadow-md transition-shadow"
      >
        {/* Cabeçalho do card */}
        <div className="flex items-start justify-between gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-sm">#{p.id}</span>
            <span className="text-xs text-muted-foreground">{hora}</span>
          </div>
          <span className="font-bold text-primary text-sm whitespace-nowrap">{formatBRL(p.total)}</span>
        </div>

        {/* Cliente e tipo */}
        <div>
          <p className="text-sm font-semibold leading-tight">{p.cliente}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{entregaLabel}</Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{PAGAMENTO_LABEL[p.formapagamento]}</Badge>
          </div>
          {p.tipoentrega === 'entrega' && p.endereco && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {p.endereco}, {p.numero} — {p.bairro}
            </p>
          )}
        </div>

        {/* Itens */}
        <div className="text-xs space-y-0.5 border-t pt-2">
          {p.itens.map((item, i) => (
            <div key={i}>
              <div className="flex justify-between">
                <span>{item.quantidade}x {item.nome}</span>
                <span className="text-muted-foreground">{formatBRL(item.preco * item.quantidade)}</span>
              </div>
              {item.adicionais && item.adicionais.length > 0 && (
                <p className="text-[10px] text-green-700 pl-2">
                  + {item.adicionais.map(a => (a.qty ?? 1) > 1 ? `${a.qty}x ${a.nome}` : a.nome).join(', ')}
                </p>
              )}
              {item.retirados && item.retirados.length > 0 && (
                <p className="text-[10px] text-muted-foreground pl-2">Sem: {item.retirados.map(r => r.nome).join(', ')}</p>
              )}
              {item.observacoes && (
                <p className="text-[10px] text-orange-600 pl-2">Obs: {item.observacoes}</p>
              )}
            </div>
          ))}
        </div>

        {/* Ações */}
        <div className="flex gap-1.5 flex-wrap border-t pt-2">
          {nextLabel && (
            <Button size="sm" className="text-xs h-7 px-2" onClick={() => handleAvancar(p)}>
              {nextLabel} →
            </Button>
          )}
          <Button size="sm" variant="outline" className="text-xs h-7 px-2" onClick={() => setEditando(p)}>
            <Pencil className="h-3 w-3 mr-1" /> Editar
          </Button>
          <PrintButton pedido={p} />
        </div>
      </div>
    )
  }

  const byStatus = (status: PedidoStatus) => pedidos.filter(p => p.status === status)
  const cancelados = pedidos.filter(p => p.status === 'Cancelado')

  return (
    <>
      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map(col => {
          const items = byStatus(col.status)
          const isFinalizados = col.status === 'Finalizado'
          const visibleItems = isFinalizados && !finalizadosAbertos ? items.slice(0, 3) : items
          const hasMore = isFinalizados && items.length > 3

          return (
            <div key={col.status} className="flex flex-col gap-2">
              {/* Header da coluna */}
              <div className={`rounded-lg border-2 px-3 py-2 flex items-center justify-between ${col.headerCls}`}>
                <span className="font-semibold text-sm">{col.label}</span>
                <Badge className={`${col.color} border text-xs`}>{items.length}</Badge>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 min-h-[80px]">
                {visibleItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">Nenhum pedido</p>
                ) : (
                  visibleItems.map(renderCard)
                )}
              </div>

              {/* Ver mais / menos (coluna Finalizado) */}
              {hasMore && (
                <button
                  onClick={() => setFinalizadosAbertos(o => !o)}
                  className="text-xs text-muted-foreground flex items-center justify-center gap-1 py-1 hover:text-foreground transition-colors"
                >
                  {finalizadosAbertos ? (
                    <><ChevronUp className="h-3 w-3" /> Mostrar menos</>
                  ) : (
                    <><ChevronDown className="h-3 w-3" /> +{items.length - 3} finalizados</>
                  )}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Cancelados (colapsado) */}
      {cancelados.length > 0 && (
        <div className="mt-4 border rounded-lg p-3 opacity-60">
          <p className="text-xs font-medium text-muted-foreground">
            Cancelados ({cancelados.length}) — {cancelados.map(p => `#${p.id}`).join(', ')}
          </p>
        </div>
      )}

      <EditarPedidoModal
        pedido={editando}
        onClose={() => setEditando(null)}
        onSaved={onUpdate}
      />
    </>
  )
}
