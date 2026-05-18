import { useState } from 'react'
import { Pedido, PedidoStatus, FormaPagamento } from '@/types'
import { avancarStatus } from '@/services/api/pedidos.service'
import { formatBRL } from '@/utils/calc'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PrintButton } from './PrintButton'
import { EditarPedidoModal } from './EditarPedidoModal'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Pencil } from 'lucide-react'

const STATUS_COLORS: Record<PedidoStatus, string> = {
  Recebido: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Em preparo': 'bg-blue-100 text-blue-800 border-blue-300',
  Finalizado: 'bg-green-100 text-green-800 border-green-300',
  Cancelado: 'bg-red-100 text-red-800 border-red-300',
}

const NEXT_LABEL: Record<PedidoStatus, string | null> = {
  Recebido: 'Iniciar preparo',
  'Em preparo': 'Finalizar',
  Finalizado: null,
  Cancelado: null,
}

const PAGAMENTO_LABEL: Record<FormaPagamento, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao: 'Cartão',
}

interface Props {
  pedidos: Pedido[]
  onUpdate: () => void
}

export function OrderMonitor({ pedidos, onUpdate }: Props) {
  const [editando, setEditando] = useState<Pedido | null>(null)

  async function handleAvancar(pedido: Pedido) {
    try {
      await avancarStatus(pedido)
      onUpdate()
    } catch (err) {
      console.error(err)
    }
  }

  const ativos = pedidos.filter(p => p.status !== 'Finalizado' && p.status !== 'Cancelado')
  const finalizados = pedidos.filter(p => p.status === 'Finalizado')
  const cancelados = pedidos.filter(p => p.status === 'Cancelado')

  function renderCard(p: Pedido) {
    const nextLabel = NEXT_LABEL[p.status]
    const hora = format(new Date(p.created_at), 'HH:mm', { locale: ptBR })
    const entregaLabel = { retirada: 'Retirada', entrega: 'Delivery', local: 'Mesa' }[p.tipoentrega]

    return (
      <div key={p.id} className={`border rounded-lg p-4 space-y-2 bg-card ${p.status === 'Cancelado' ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm">#{p.id}</span>
            <span className="text-sm text-muted-foreground">{hora}</span>
            <Badge variant="outline" className={STATUS_COLORS[p.status]}>
              {p.status}
            </Badge>
            <Badge variant="secondary" className="text-xs">{entregaLabel}</Badge>
            <Badge variant="outline" className="text-xs">{PAGAMENTO_LABEL[p.formapagamento]}</Badge>
          </div>
          <span className="font-bold text-primary">{formatBRL(p.total)}</span>
        </div>

        <div>
          <p className="text-sm font-semibold">{p.cliente}</p>
          {p.phone && <p className="text-xs text-muted-foreground">{p.phone}</p>}
          {p.tipoentrega === 'entrega' && p.endereco && (
            <p className="text-xs text-muted-foreground">
              {p.endereco}, {p.numero} — {p.bairro}
            </p>
          )}
        </div>

        <div className="text-sm space-y-0.5">
          {p.itens.map((item, i) => (
            <div key={i} className="flex justify-between">
              <span>{item.quantidade}x {item.nome}</span>
              <span className="text-muted-foreground">{formatBRL(item.preco * item.quantidade)}</span>
            </div>
          ))}
        </div>

        {p.status !== 'Cancelado' && (
          <div className="flex gap-2 flex-wrap">
            {nextLabel && (
              <Button size="sm" onClick={() => handleAvancar(p)}>
                {nextLabel}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setEditando(p)}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
            </Button>
            <PrintButton pedido={p} />
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        <div>
          <h3 className="font-semibold text-lg mb-3">Em andamento ({ativos.length})</h3>
          {ativos.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum pedido ativo</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {ativos.map(renderCard)}
            </div>
          )}
        </div>

        {finalizados.length > 0 && (
          <div>
            <h3 className="font-semibold text-lg mb-3">Finalizados ({finalizados.length})</h3>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {finalizados.map(renderCard)}
            </div>
          </div>
        )}

        {cancelados.length > 0 && (
          <div>
            <h3 className="font-semibold text-lg mb-3 text-red-600">Cancelados ({cancelados.length})</h3>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {cancelados.map(renderCard)}
            </div>
          </div>
        )}
      </div>

      <EditarPedidoModal
        pedido={editando}
        onClose={() => setEditando(null)}
        onSaved={onUpdate}
      />
    </>
  )
}
