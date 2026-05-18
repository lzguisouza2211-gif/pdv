import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { CheckCircle, UserCheck, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Cliente, TipoEntrega } from '@/types'
import {
  criarCliente,
  registrarPedidoNoCliente,
  vincularClienteAoPedido,
  atualizarEnderecoCliente,
  saveClienteSession,
} from '@/services/api/clientes.service'

interface SuccessModalProps {
  open: boolean
  clienteName: string
  clienteEncontrado: Cliente | null
  nomeCliente: string
  phoneCliente: string
  totalPedido: number
  pedidoId: number | string
  tipoentrega: TipoEntrega
  endereco: string
  numero: string
  bairro: string
  onClose: () => void
}

type SaveState = 'idle' | 'loading' | 'saved' | 'dismissed'

export function SuccessModal({
  open,
  clienteName,
  clienteEncontrado,
  nomeCliente,
  phoneCliente,
  totalPedido,
  pedidoId,
  tipoentrega,
  endereco,
  numero,
  bairro,
  onClose,
}: SuccessModalProps) {
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    setSaveState('idle')
    return () => { mountedRef.current = false }
  }, [open])

  // Cliente já cadastrado: dispara as operações automaticamente ao montar
  useEffect(() => {
    if (!open || !clienteEncontrado || !pedidoId) return

    void (async () => {
      try {
        await Promise.all([
          registrarPedidoNoCliente(clienteEncontrado.id, totalPedido),
          vincularClienteAoPedido(pedidoId, clienteEncontrado.id),
        ])
      } catch (err) {
        console.error('[SuccessModal] erro ao registrar pedido no cliente:', err)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clienteEncontrado?.id])

  async function handleSalvar() {
    if (!nomeCliente || !phoneCliente || saveState !== 'idle') return
    setSaveState('loading')
    try {
      const novoCliente = await criarCliente(nomeCliente, phoneCliente)
      if (!mountedRef.current) return
      await Promise.all([
        registrarPedidoNoCliente(novoCliente.id, totalPedido),
        vincularClienteAoPedido(pedidoId, novoCliente.id),
      ])
      if (!mountedRef.current) return
      saveClienteSession(phoneCliente, nomeCliente)
      setSaveState('saved')
    } catch (err) {
      console.error('[SuccessModal] erro ao salvar cliente:', err)
      if (mountedRef.current) setSaveState('idle')
    }
  }

  const totalPedidosCliente = clienteEncontrado
    ? clienteEncontrado.total_pedidos + 1
    : 0

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm text-center">
        <div className="flex flex-col items-center gap-4 py-4">
          <CheckCircle className="h-16 w-16 text-green-500" />
          <div>
            <DialogTitle className="text-xl font-bold">Pedido enviado!</DialogTitle>
            <DialogDescription className="mt-1">
              {clienteName
                ? <>Obrigado, <span className="font-medium text-foreground">{clienteName}</span>! Seu pedido foi recebido.</>
                : 'Seu pedido foi recebido com sucesso.'}
            </DialogDescription>
          </div>

          {/* Seção de cliente — só exibe se houver telefone */}
          {clienteEncontrado ? (
            <Card className="w-full border-green-200 bg-green-50">
              <CardContent className="pt-4 pb-3 flex items-start gap-3 text-left">
                <UserCheck className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                <p className="text-sm text-green-800">
                  Bem-vindo de volta, <span className="font-semibold">{clienteEncontrado.nome}</span>!{' '}
                  Este é o seu{' '}
                  <span className="font-semibold">{totalPedidosCliente}º</span> pedido conosco. Obrigado!
                </p>
              </CardContent>
            </Card>
          ) : phoneCliente ? (
            <Card className="w-full border-muted">
              <CardContent className="pt-4 pb-3 flex flex-col gap-3 text-left">
                <div className="flex items-start gap-3">
                  <UserPlus className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  {saveState === 'saved' ? (
                    <p className="text-sm text-green-700">
                      Dados salvos! Da próxima vez preenchemos tudo para você.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Quer agilizar seu próximo pedido? Salve seus dados e não precisará digitar de novo.
                    </p>
                  )}
                </div>
                {saveState !== 'saved' && saveState !== 'dismissed' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={handleSalvar}
                      disabled={saveState === 'loading'}
                    >
                      {saveState === 'loading' ? 'Salvando…' : 'Salvar meus dados'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1"
                      onClick={() => setSaveState('dismissed')}
                      disabled={saveState === 'loading'}
                    >
                      Agora não
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Button onClick={onClose} className="w-full">
            Fazer novo pedido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
