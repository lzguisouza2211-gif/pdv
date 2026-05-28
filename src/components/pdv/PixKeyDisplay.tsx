import { useEffect, useState } from 'react'
import { PIX_CONFIG } from '@/config/pix'
import { fetchPixConfig } from '@/services/api/storeStatus.service'
import { formatBRL } from '@/utils/calc'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'

interface Props {
  total: number
}

interface PixInfo {
  key: string
  displayKey: string
  recipientName: string
}

export function PixKeyDisplay({ total }: Props) {
  const [pix, setPix] = useState<PixInfo>({
    key: PIX_CONFIG.key,
    displayKey: PIX_CONFIG.displayKey,
    recipientName: PIX_CONFIG.recipientName,
  })

  useEffect(() => {
    fetchPixConfig().then((config) => {
      if (config) setPix(config)
    })
  }, [])

  function copyKey() {
    navigator.clipboard.writeText(pix.key).then(() => {
      toast({ title: 'Chave copiada!', description: pix.displayKey })
    })
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
      <p className="text-sm font-semibold text-center">Pague via PIX</p>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Chave PIX</p>
          <p className="font-mono font-semibold">{pix.displayKey}</p>
          <p className="text-xs text-muted-foreground">{pix.recipientName}</p>
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
