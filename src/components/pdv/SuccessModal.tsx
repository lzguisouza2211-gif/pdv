import { Dialog, DialogContent } from '@/components/ui/dialog'
import { CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SuccessModalProps {
  open: boolean
  clienteName: string
  onClose: () => void
}

export function SuccessModal({ open, clienteName, onClose }: SuccessModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm text-center">
        <div className="flex flex-col items-center gap-4 py-4">
          <CheckCircle className="h-16 w-16 text-green-500" />
          <div>
            <h2 className="text-xl font-bold">Pedido enviado!</h2>
            {clienteName && (
              <p className="text-muted-foreground mt-1">
                Obrigado, <span className="font-medium">{clienteName}</span>! Seu pedido foi recebido.
              </p>
            )}
          </div>
          <Button onClick={onClose} className="w-full">
            Fazer novo pedido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
