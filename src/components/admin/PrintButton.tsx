import { useState } from 'react'
import { Pedido } from '@/types'
import { Button } from '@/components/ui/button'
import { Printer } from 'lucide-react'
import { printJob } from '@/services/printer/printQueue'

interface Props {
  pedido: Pedido
  tipo: 'producao' | 'motoboy'
}

export function PrintButton({ pedido, tipo }: Props) {
  const [printing, setPrinting] = useState(false)

  async function handlePrint() {
    if (printing) return
    setPrinting(true)
    try {
      await printJob(pedido, tipo)
    } catch (err) {
      console.error('Falha na impressão', err)
    } finally {
      setPrinting(false)
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handlePrint} disabled={printing}>
      <Printer className="h-4 w-4 mr-1" />
      {tipo === 'producao' ? 'Cozinha' : 'Cliente'}
    </Button>
  )
}
