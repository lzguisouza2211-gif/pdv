import { useRef, useState } from 'react'
import { useCart, useCartSubtotal } from '@/store/useCart'
import { TipoEntrega, FormaPagamento } from '@/types'
import { normalizePedidoPayload } from '@/utils/pedido'
import { validarTelefoneBrasileiro, formatarTelefone } from '@/utils/validation'
import { formatBRL, calcTotal, calcTroco, calcItemPrice } from '@/utils/calc'
import { criarPedido } from '@/services/api/pedidos.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { PixKeyDisplay } from './PixKeyDisplay'
import { SuccessModal } from './SuccessModal'
import { X, Minus, Plus, ShoppingCart } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  deliveryFee: number
}

export function CartDrawer({ open, onClose, deliveryFee }: Props) {
  const { items, remove, updateQty, clear } = useCart()
  const subtotal = useCartSubtotal()

  const [cliente, setCliente] = useState('')
  const [phone, setPhone] = useState('')
  const [tipoentrega, setTipoentrega] = useState<TipoEntrega>('retirada')
  const [endereco, setEndereco] = useState('')
  const [numero, setNumero] = useState('')
  const [bairro, setBairro] = useState('')
  const [formapagamento, setFormapagamento] = useState<FormaPagamento>('dinheiro')
  const [valorPago, setValorPago] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [successCliente, setSuccessCliente] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const submitting = useRef(false)

  const taxa = tipoentrega === 'entrega' ? deliveryFee : 0
  const total = calcTotal(subtotal, taxa)
  const troco =
    formapagamento === 'dinheiro' && valorPago
      ? calcTroco(parseFloat(valorPago.replace(',', '.')), total)
      : null

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!cliente.trim()) errs.cliente = 'Nome obrigatório'
    if (!validarTelefoneBrasileiro(phone)) errs.phone = 'Telefone inválido'
    if (items.length === 0) errs.cart = 'Carrinho vazio'
    if (tipoentrega === 'entrega') {
      if (!endereco.trim()) errs.endereco = 'Rua obrigatória'
      if (!numero.trim()) errs.numero = 'Número obrigatório'
      if (!bairro.trim()) errs.bairro = 'Bairro obrigatório'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    if (submitting.current || loading) return
    if (!validate()) return
    submitting.current = true
    setLoading(true)

    try {
      const itens = normalizePedidoPayload(items)
      const trocoVal =
        formapagamento === 'dinheiro' && valorPago
          ? calcTroco(parseFloat(valorPago.replace(',', '.')), total)
          : undefined

      await criarPedido({
        cliente: cliente.trim(),
        phone,
        tipoentrega,
        endereco: tipoentrega === 'entrega' ? endereco : undefined,
        numero: tipoentrega === 'entrega' ? numero : undefined,
        bairro: tipoentrega === 'entrega' ? bairro : undefined,
        itens,
        formapagamento,
        troco: trocoVal,
        taxa_entrega: taxa,
        total,
      })

      setSuccessCliente(cliente.trim())
      clear()
      setCliente('')
      setPhone('')
      setEndereco('')
      setNumero('')
      setBairro('')
      setValorPago('')
      setTipoentrega('retirada')
      setFormapagamento('dinheiro')
      onClose()
      setShowSuccess(true)
    } catch (err: unknown) {
      const e = err as Record<string, unknown>
      console.error('Supabase error:', e?.code, e?.message, e?.details, e?.hint)
      setErrors({ submit: `Erro: ${e?.message ?? 'Tente novamente.'}` })
    } finally {
      setLoading(false)
      submitting.current = false
    }
  }

  if (!open && !showSuccess) return null

  return (
    <>
      {open && <div
        className="drawer-overlay fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />}
      {open && <div className="drawer-panel fixed right-0 top-0 z-50 h-full w-full max-w-md bg-background shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            <span className="font-semibold text-lg">Carrinho ({items.length})</span>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Items */}
          {items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Carrinho vazio</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.cartKey} className="border rounded-md p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium capitalize text-sm">{item.name}</p>
                      {item.extras.filter(e => e.tipo === 'add').map((e) => (
                        <p key={e.nome} className="text-xs text-muted-foreground">+ {e.nome} ({formatBRL(e.preco)})</p>
                      ))}
                      {item.extras.filter(e => e.tipo === 'remove').map((e) => (
                        <p key={e.nome} className="text-xs text-muted-foreground">- sem {e.nome}</p>
                      ))}
                      {item.observacoes && (
                        <p className="text-xs italic text-muted-foreground">{item.observacoes}</p>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-primary shrink-0">
                      {formatBRL(calcItemPrice(item) * item.qty)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Button size="icon" variant="outline" className="h-7 w-7"
                      onClick={() => remove(item.cartKey)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="text-sm font-medium w-6 text-center">{item.qty}</span>
                    <Button size="icon" variant="outline" className="h-7 w-7"
                      onClick={() => updateQty(item.cartKey, item.qty + 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Separator />

          {/* Resumo */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatBRL(subtotal)}</span>
            </div>
            {tipoentrega === 'entrega' && (
              <div className="flex justify-between text-muted-foreground">
                <span>Taxa de entrega</span>
                <span>{formatBRL(taxa)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span className="text-primary">{formatBRL(total)}</span>
            </div>
          </div>

          <Separator />

          {/* Formulário */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="cliente">Nome *</Label>
              <Input
                id="cliente"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Seu nome"
                className={errors.cliente ? 'border-destructive' : ''}
              />
              {errors.cliente && <p className="text-xs text-destructive mt-1">{errors.cliente}</p>}
            </div>

            <div>
              <Label htmlFor="phone">Telefone *</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(formatarTelefone(e.target.value))}
                placeholder="(11) 99999-9999"
                className={errors.phone ? 'border-destructive' : ''}
              />
              {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone}</p>}
            </div>

            {/* Tipo de entrega */}
            <div>
              <Label>Tipo de entrega</Label>
              <RadioGroup
                value={tipoentrega}
                onValueChange={(v) => setTipoentrega(v as TipoEntrega)}
                className="flex gap-4 mt-1"
              >
                {(['retirada', 'entrega', 'local'] as TipoEntrega[]).map((t) => (
                  <div key={t} className="flex items-center gap-2">
                    <RadioGroupItem value={t} id={`tipo-${t}`} />
                    <Label htmlFor={`tipo-${t}`} className="cursor-pointer capitalize">
                      {t === 'local' ? 'Mesa' : t.charAt(0).toUpperCase() + t.slice(1)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {tipoentrega === 'entrega' && (
              <div className="space-y-2">
                <div>
                  <Label htmlFor="endereco">Rua *</Label>
                  <Input
                    id="endereco"
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    placeholder="Nome da rua"
                    className={errors.endereco ? 'border-destructive' : ''}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="numero">Número *</Label>
                    <Input
                      id="numero"
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      placeholder="123"
                      className={errors.numero ? 'border-destructive' : ''}
                    />
                  </div>
                  <div>
                    <Label htmlFor="bairro">Bairro *</Label>
                    <Input
                      id="bairro"
                      value={bairro}
                      onChange={(e) => setBairro(e.target.value)}
                      placeholder="Bairro"
                      className={errors.bairro ? 'border-destructive' : ''}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Forma de pagamento */}
            <div>
              <Label>Forma de pagamento</Label>
              <RadioGroup
                value={formapagamento}
                onValueChange={(v) => setFormapagamento(v as FormaPagamento)}
                className="flex gap-4 mt-1"
              >
                {(['dinheiro', 'cartao', 'pix'] as FormaPagamento[]).map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <RadioGroupItem value={f} id={`pg-${f}`} />
                    <Label htmlFor={`pg-${f}`} className="cursor-pointer capitalize">
                      {f === 'cartao' ? 'Cartão' : f.charAt(0).toUpperCase() + f.slice(1)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {formapagamento === 'dinheiro' && (
              <div>
                <Label htmlFor="troco">Troco para R$ (opcional)</Label>
                <Input
                  id="troco"
                  type="number"
                  min={total}
                  step="0.01"
                  value={valorPago}
                  onChange={(e) => setValorPago(e.target.value)}
                  placeholder={formatBRL(total)}
                />
                {troco !== null && troco >= 0 && (
                  <p className="text-sm mt-1 text-muted-foreground">
                    Troco: <span className="font-semibold">{formatBRL(troco)}</span>
                  </p>
                )}
              </div>
            )}

            {formapagamento === 'pix' && <PixKeyDisplay total={total} />}

            {errors.submit && (
              <p className="text-sm text-destructive">{errors.submit}</p>
            )}
            {errors.cart && (
              <p className="text-sm text-destructive">{errors.cart}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t">
          <Button
            className="w-full"
            size="lg"
            onClick={handleSubmit}
            disabled={loading || items.length === 0}
          >
            {loading ? 'Enviando…' : `Confirmar Pedido — ${formatBRL(total)}`}
          </Button>
        </div>
      </div>}

      <SuccessModal
        open={showSuccess}
        clienteName={successCliente}
        onClose={() => setShowSuccess(false)}
      />
    </>
  )
}
