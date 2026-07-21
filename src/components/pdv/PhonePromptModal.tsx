import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
      <DialogContent className="max-w-sm p-0 overflow-hidden" aria-describedby="phone-prompt-desc">
        {/* Header temático */}
        <div style={{
          background: 'linear-gradient(160deg, #1E293B 0%, #11182A 100%)',
          padding: '28px 24px 24px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'relative', zIndex: 1,
            width: 64, height: 64, borderRadius: 999,
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(6px)',
            border: '1.5px solid rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
            fontSize: 28,
          }}>
            🍔
          </div>

          <DialogTitle style={{
            position: 'relative', zIndex: 1,
            color: '#fff', fontSize: 20, fontWeight: 800,
            letterSpacing: -0.3, margin: 0,
          }}>
            Luizão Lanches
          </DialogTitle>
          <DialogDescription id="phone-prompt-desc" style={{
            position: 'relative', zIndex: 1,
            color: 'rgba(255,255,255,0.6)', fontSize: 13,
            marginTop: 4, fontWeight: 500,
          }}>
            Informe seu telefone pra gente te reconhecer nos próximos pedidos
          </DialogDescription>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Input
              id="prompt-phone"
              value={phone}
              onChange={(e) => { setPhone(formatarTelefone(e.target.value)); setError('') }}
              onKeyDown={handleKeyDown}
              placeholder="(11) 99999-9999"
              inputMode="tel"
              className={error ? 'border-destructive' : ''}
              autoFocus
              style={{ fontSize: 16, height: 46, borderRadius: 12 }}
            />
            {error && <p style={{ fontSize: 12, color: '#DC2626', marginTop: 4 }}>{error}</p>}
          </div>

          <Button
            className="w-full"
            onClick={handleContinuar}
            disabled={loading}
            style={{ height: 46, borderRadius: 12, fontSize: 15, fontWeight: 700 }}
          >
            {loading ? 'Verificando…' : 'Continuar'}
          </Button>

          <button
            type="button"
            onClick={handlePular}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '2px 0',
            }}
          >
            Pular por agora
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
