import { useState } from 'react'
import { Pedido } from '@/types'
import { Button } from '@/components/ui/button'
import { Printer } from 'lucide-react'
import { printJob } from '@/services/printer/printQueue'
import { useToast } from '@/hooks/use-toast'

interface Props {
  pedido: Pedido
}

export function PrintButton({ pedido }: Props) {
  const [printing, setPrinting] = useState(false)
  const { toast } = useToast()

  async function handlePrint() {
    if (printing) return
    setPrinting(true)
    try {
      await printJob(pedido, 'ambos')
      toast({
        title: 'Impressão enviada',
        description: `Pedido #${pedido.id} enviado para a impressora.`,
      })
    } catch (err) {
      console.error('Falha na impressão', err)
      const description = err instanceof Error ? err.message : 'Verifique o backend de impressão local.'
      toast({
        title: 'Falha ao imprimir',
        description,
        variant: 'destructive',
      })
    } finally {
      setPrinting(false)
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handlePrint} disabled={printing}>
      <Printer className="h-4 w-4 mr-1" />
      {printing ? 'Imprimindo…' : 'Imprimir'}
    </Button>
  )
}
