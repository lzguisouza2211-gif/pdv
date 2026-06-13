import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { CheckCircle, Clock, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TipoEntrega } from '@/types'

const ENTREGA_LABEL: Record<TipoEntrega, string> = {
  entrega:  'Entrega a domicílio',
  retirada: 'Retirada no balcão',
  local:    'Pedido na mesa',
}

function maskPhone(phone: string): string {
  if (phone.length < 4) return phone
  return phone.slice(0, -4) + '****'
}

interface SuccessModalProps {
  open: boolean
  clienteName: string
  pedidoId: string
  phone: string
  tempoEspera: number
  tipoentrega: TipoEntrega
  onClose: () => void
}

export function SuccessModal({
  open,
  clienteName,
  pedidoId,
  phone,
  tempoEspera,
  tipoentrega,
  onClose,
}: SuccessModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        {/* Header verde */}
        <div className="bg-green-500 px-6 pt-8 pb-6 flex flex-col items-center gap-2 text-center text-white">
          <div className="rounded-full bg-white/20 p-3">
            <CheckCircle className="h-10 w-10 text-white" />
          </div>
          <div>
            <DialogTitle className="text-white text-xl font-bold">
              Pedido #{pedidoId} enviado!
            </DialogTitle>
            <DialogDescription className="text-green-100 mt-0.5">
              {clienteName
                ? <>Obrigado, <span className="font-semibold text-white">{clienteName}</span>! 🙌</>
                : 'Seu pedido foi recebido com sucesso.'}
            </DialogDescription>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Tempo estimado */}
          <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
            <div className="rounded-full bg-orange-100 p-2 shrink-0">
              <Clock className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground leading-none mb-0.5">
                {ENTREGA_LABEL[tipoentrega]}
              </p>
              <p className="text-sm font-semibold">
                Pronto em aproximadamente{' '}
                <span className="text-primary">{tempoEspera} min</span>
              </p>
            </div>
          </div>

          {/* WhatsApp */}
          {phone && (
            <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-3">
              <div className="rounded-full bg-green-100 p-2 shrink-0">
                <MessageCircle className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground leading-none mb-0.5">
                  Confirmação via WhatsApp
                </p>
                <p className="text-sm font-semibold">{maskPhone(phone)}</p>
              </div>
            </div>
          )}

          <Button onClick={onClose} className="w-full">
            Fazer novo pedido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
