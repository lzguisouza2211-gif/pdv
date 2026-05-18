import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Smartphone } from 'lucide-react'
import { validarTelefoneBrasileiro, formatarTelefone } from '@/utils/validation'
import {
  buscarClientePorTelefone,
  saveClienteSession,
  markPromptSkipped,
} from '@/services/api/clientes.service'

interface Props {
  open: boolean
  onDone: () => void
}

export function PhonePromptModal({ open, onDone }: Props) {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleContinuar() {
    if (!validarTelefoneBrasileiro(phone)) {
      setError('Telefone inválido. Ex: (11) 99999-9999')
      return
    }
    setLoading(true)
    setError('')
    try {
      const found = await buscarClientePorTelefone(phone)
      saveClienteSession(phone, found?.nome ?? '')
    } catch {
      // salva só o telefone; o nome será preenchido pelo cliente no carrinho
      saveClienteSession(phone, '')
    } finally {
      setLoading(false)
      onDone()
    }
  }

  function handlePular() {
    markPromptSkipped()
    onDone()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleContinuar()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handlePular() }}>
      <DialogContent className="max-w-sm" aria-describedby="phone-prompt-desc">
        <div className="flex flex-col items-center gap-4 pt-2 pb-1 text-center">
          <div className="bg-primary/10 rounded-full p-3">
            <Smartphone className="h-7 w-7 text-primary" />
          </div>
          <div>
            <DialogTitle className="text-lg font-bold">Bem-vindo ao Luizão Lanches!</DialogTitle>
            <DialogDescription id="phone-prompt-desc" className="mt-1 text-sm">
              Informe seu telefone para agilizar seus pedidos futuros — preencheremos tudo automaticamente.
            </DialogDescription>
          </div>

          <div className="w-full space-y-3 text-left">
            <div>
              <Label htmlFor="prompt-phone">Número de telefone</Label>
              <Input
                id="prompt-phone"
                value={phone}
                onChange={(e) => { setPhone(formatarTelefone(e.target.value)); setError('') }}
                onKeyDown={handleKeyDown}
                placeholder="(11) 99999-9999"
                className={error ? 'border-destructive' : ''}
                autoFocus
              />
              {error && <p className="text-xs text-destructive mt-1">{error}</p>}
            </div>

            <Button className="w-full" onClick={handleContinuar} disabled={loading}>
              {loading ? 'Verificando…' : 'Continuar'}
            </Button>
          </div>

          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
            onClick={handlePular}
          >
            Pular por agora
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
