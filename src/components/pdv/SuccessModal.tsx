import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle } from 'lucide-react'

interface Props {
  open: boolean
  clienteName: string
  onClose: () => void
}

export function SuccessModal({ open, clienteName, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <div className="flex justify-center mb-2">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <DialogTitle className="text-xl">Pedido recebido!</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground">
          Obrigado, <span className="font-semibold">{clienteName}</span>! Seu pedido foi registrado e
          logo estará sendo preparado.
        </p>
        <Button onClick={onClose} className="w-full mt-2">
          Fazer novo pedido
        </Button>
      </DialogContent>
    </Dialog>
  )
}
