import { PIX_CONFIG } from '@/config/pix'
import { formatBRL } from '@/utils/calc'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'

interface Props {
  total: number
}

export function PixKeyDisplay({ total }: Props) {
  function copyKey() {
    navigator.clipboard.writeText(PIX_CONFIG.key).then(() => {
      toast({ title: 'Chave copiada!', description: PIX_CONFIG.displayKey })
    })
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
      <p className="text-sm font-semibold text-center">Pague via PIX</p>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">CNPJ</p>
          <p className="font-mono font-semibold">{PIX_CONFIG.displayKey}</p>
          <p className="text-xs text-muted-foreground">{PIX_CONFIG.recipientName}</p>
        </div>
        <Button size="icon" variant="ghost" onClick={copyKey}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-center text-lg font-bold text-primary">
        Valor: {formatBRL(total)}
      </p>
    </div>
  )
}
