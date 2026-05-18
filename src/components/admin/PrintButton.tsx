import { useState } from 'react'
import { Pedido } from '@/types'
import { Button } from '@/components/ui/button'
import { Printer } from 'lucide-react'
import { printJob } from '@/services/printer/printQueue'

interface Props {
  pedido: Pedido
}

export function PrintButton({ pedido }: Props) {
  const [printing, setPrinting] = useState(false)

  async function handlePrint() {
    if (printing) return
    setPrinting(true)
    try {
      await printJob(pedido, 'ambos')
    } catch (err) {
      console.error('Falha na impressão', err)
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
