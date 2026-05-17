import { Pedido, PedidoStatus } from '@/types'
import { avancarStatus } from '@/services/api/pedidos.service'
import { formatBRL } from '@/utils/calc'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PrintButton } from './PrintButton'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STATUS_COLORS: Record<PedidoStatus, string> = {
  Recebido: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Em preparo': 'bg-blue-100 text-blue-800 border-blue-300',
  Finalizado: 'bg-green-100 text-green-800 border-green-300',
}

const NEXT_LABEL: Record<PedidoStatus, string | null> = {
  Recebido: 'Iniciar preparo',
  'Em preparo': 'Finalizar',
  Finalizado: null,
}

interface Props {
  pedidos: Pedido[]
  onUpdate: () => void
}

export function OrderMonitor({ pedidos, onUpdate }: Props) {
  async function handleAvancar(pedido: Pedido) {
    try {
      await avancarStatus(pedido)
      onUpdate()
    } catch (err) {
      console.error(err)
    }
  }

  const ativos = pedidos.filter((p) => p.status !== 'Finalizado')
  const finalizados = pedidos.filter((p) => p.status === 'Finalizado')

  function renderCard(p: Pedido) {
    const nextLabel = NEXT_LABEL[p.status]
    const hora = format(new Date(p.created_at), 'HH:mm', { locale: ptBR })
    const entregaLabel = { retirada: 'Retirada', entrega: 'Delivery', local: 'Mesa' }[p.tipoentrega]

    return (
      <div key={p.id} className="border rounded-lg p-4 space-y-2 bg-card">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">#{p.id}</span>
            <span className="text-sm text-muted-foreground">{hora}</span>
            <Badge variant="outline" className={STATUS_COLORS[p.status]}>
              {p.status}
            </Badge>
            <Badge variant="secondary" className="text-xs">{entregaLabel}</Badge>
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

        <div className="flex gap-2 flex-wrap">
          {nextLabel && (
            <Button size="sm" onClick={() => handleAvancar(p)}>
              {nextLabel}
            </Button>
          )}
          <PrintButton pedido={p} tipo="producao" />
          <PrintButton pedido={p} tipo="motoboy" />
        </div>
      </div>
    )
  }

  return (
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
    </div>
  )
}
