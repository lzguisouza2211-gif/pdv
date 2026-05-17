import { useEffect, useState } from 'react'
import { Pedido } from '@/types'
import { fetchPedidos } from '@/services/api/pedidos.service'
import { supabase } from '@/services/supabaseClient'
import { useUser } from '@/store/useUser'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/utils/calc'
import { format, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type DailyData = {
  dia: string
  faturamento: number
  pedidos: number
  pix: number
  dinheiro: number
  cartao: number
}

export function Financeiro() {
  const { user } = useUser()
  const [dailyData, setDailyData] = useState<DailyData[]>([])
  const [loading, setLoading] = useState(true)
  const [fechando, setFechando] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const start = format(startOfMonth(new Date()), 'yyyy-MM-dd')
      const end = format(new Date(), 'yyyy-MM-dd')
      const pedidos = await fetchPedidos({ startDate: start, endDate: end, status: 'Finalizado' })

      const map = new Map<string, DailyData>()
      for (const p of pedidos) {
        const dia = p.created_at.split('T')[0]
        if (!map.has(dia)) {
          map.set(dia, { dia, faturamento: 0, pedidos: 0, pix: 0, dinheiro: 0, cartao: 0 })
        }
        const d = map.get(dia)!
        d.faturamento += p.total
        d.pedidos += 1
        if (p.formapagamento === 'pix') d.pix += p.total
        else if (p.formapagamento === 'dinheiro') d.dinheiro += p.total
        else if (p.formapagamento === 'cartao') d.cartao += p.total
      }

      setDailyData(
        Array.from(map.values()).sort((a, b) => a.dia.localeCompare(b.dia))
      )
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function fecharCaixa() {
    if (!user) return
    setFechando(true)
    try {
      const today = format(new Date(), 'yyyy-MM-dd')
      const pedidos = await fetchPedidos({ startDate: today, endDate: today, status: 'Finalizado' })
      const total = pedidos.reduce((s, p) => s + p.total, 0)
      const pix = pedidos.filter(p => p.formapagamento === 'pix')
      const dinheiro = pedidos.filter(p => p.formapagamento === 'dinheiro')
      const cartao = pedidos.filter(p => p.formapagamento === 'cartao')

      await supabase.from('fechamentos_caixa').insert([{
        data: today,
        periodo: 'dia',
        total,
        total_pedidos: pedidos.length,
        pix_valor: pix.reduce((s, p) => s + p.total, 0),
        pix_quantidade: pix.length,
        dinheiro_valor: dinheiro.reduce((s, p) => s + p.total, 0),
        dinheiro_quantidade: dinheiro.length,
        cartao_valor: cartao.reduce((s, p) => s + p.total, 0),
        cartao_quantidade: cartao.length,
        created_by: user.id,
      }])
      alert(`Caixa fechado! Total do dia: ${formatBRL(total)}`)
    } catch (err) {
      console.error(err)
    } finally {
      setFechando(false)
    }
  }

  const totalMes = dailyData.reduce((s, d) => s + d.faturamento, 0)
  const totalPedidosMes = dailyData.reduce((s, d) => s + d.pedidos, 0)

  if (loading) return <p className="text-muted-foreground">Carregando…</p>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Faturamento do Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{formatBRL(totalMes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pedidos no Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalPedidosMes}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Faturamento Diário</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dia" tickFormatter={(d) => format(new Date(d + 'T00:00:00'), 'dd/MM', { locale: ptBR })} />
              <YAxis tickFormatter={(v) => `R$${v}`} />
              <Tooltip formatter={(v: number) => formatBRL(v)} />
              <Legend />
              <Bar dataKey="pix" name="PIX" fill="#22c55e" stackId="a" />
              <Bar dataKey="dinheiro" name="Dinheiro" fill="#3b82f6" stackId="a" />
              <Bar dataKey="cartao" name="Cartão" fill="#f59e0b" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={fecharCaixa} disabled={fechando} variant="outline">
          {fechando ? 'Fechando…' : 'Fechar Caixa do Dia'}
        </Button>
      </div>
    </div>
  )
}
