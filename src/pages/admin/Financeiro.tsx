import { useEffect, useState, useCallback } from 'react'
import { fetchPedidos } from '@/services/api/pedidos.service'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { formatBRL } from '@/utils/calc'
import { format, startOfMonth, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { caixaEstaFechado } from '@/hooks/useCaixaAutomatico'
import { TrendingUp, ShoppingBag, Receipt, QrCode, Banknote, CreditCard, CheckCircle2, Circle, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Period = 'hoje' | 'semana' | 'mes'

type DailyData = {
  dia: string
  faturamento: number
  pedidos: number
  pix: number
  dinheiro: number
  cartao: number
}

function getDateRange(period: Period): { start: string; end: string } {
  const today = new Date()
  const end = format(today, 'yyyy-MM-dd')
  if (period === 'hoje') return { start: end, end }
  if (period === 'semana') return { start: format(subDays(today, 6), 'yyyy-MM-dd'), end }
  return { start: format(startOfMonth(today), 'yyyy-MM-dd'), end }
}

function pct(value: number, total: number) {
  if (total === 0) return '0%'
  return `${Math.round((value / total) * 100)}%`
}

export function Financeiro() {
  const [period, setPeriod] = useState<Period>('mes')
  const [dailyData, setDailyData] = useState<DailyData[]>([])
  const [loading, setLoading] = useState(true)
  const [caixaFechado, setCaixaFechado] = useState<boolean | null>(null)

  const hoje = format(new Date(), 'yyyy-MM-dd')

  const loadData = useCallback(async (p: Period) => {
    setLoading(true)
    try {
      const { start, end } = getDateRange(p)
      const todosPedidos = await fetchPedidos({ startDate: start, endDate: end })
      const pedidos = todosPedidos.filter(p => p.status !== 'Cancelado')

      const map = new Map<string, DailyData>()
      for (const pedido of pedidos) {
        const dia = pedido.created_at.split('T')[0]
        if (!map.has(dia)) {
          map.set(dia, { dia, faturamento: 0, pedidos: 0, pix: 0, dinheiro: 0, cartao: 0 })
        }
        const d = map.get(dia)!
        d.faturamento += pedido.total
        d.pedidos += 1
        if (pedido.formapagamento === 'pix') d.pix += pedido.total
        else if (pedido.formapagamento === 'dinheiro') d.dinheiro += pedido.total
        else if (pedido.formapagamento === 'cartao') d.cartao += pedido.total
      }

      setDailyData(
        Array.from(map.values()).sort((a, b) => a.dia.localeCompare(b.dia))
      )
    } catch (err) {
    } finally {
      setLoading(false)
    }
  }, [])

  const checkCaixaStatus = useCallback(async () => {
    const fechado = await caixaEstaFechado(hoje)
    setCaixaFechado(fechado)
  }, [hoje])

  useEffect(() => {
    loadData(period)
    checkCaixaStatus()
  }, [period, loadData, checkCaixaStatus])

  const totalFaturamento = dailyData.reduce((s, d) => s + d.faturamento, 0)
  const totalPedidos = dailyData.reduce((s, d) => s + d.pedidos, 0)
  const ticketMedio = totalPedidos > 0 ? totalFaturamento / totalPedidos : 0
  const totalPix = dailyData.reduce((s, d) => s + d.pix, 0)
  const totalDinheiro = dailyData.reduce((s, d) => s + d.dinheiro, 0)
  const totalCartao = dailyData.reduce((s, d) => s + d.cartao, 0)

  const periodLabel: Record<Period, string> = {
    hoje: 'Hoje',
    semana: 'Últimos 7 dias',
    mes: format(new Date(), 'MMMM yyyy', { locale: ptBR }),
  }

  function handlePrint() {
    const rows = dailyData.map(d => `
      <tr>
        <td>${format(new Date(d.dia + 'T00:00:00'), 'EEE, dd/MM/yyyy', { locale: ptBR })}</td>
        <td style="text-align:right">${d.pedidos}</td>
        <td style="text-align:right">${d.pix > 0 ? formatBRL(d.pix) : '—'}</td>
        <td style="text-align:right">${d.dinheiro > 0 ? formatBRL(d.dinheiro) : '—'}</td>
        <td style="text-align:right">${d.cartao > 0 ? formatBRL(d.cartao) : '—'}</td>
        <td style="text-align:right;font-weight:600">${formatBRL(d.faturamento)}</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório — ${periodLabel[period]}</title>
      <style>
        body{font-family:sans-serif;padding:24px;color:#111}
        h2{margin:0 0 4px}p{margin:0 0 16px;color:#555;font-size:13px}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th,td{padding:8px 10px;border-bottom:1px solid #e5e7eb}
        th{background:#f9fafb;font-weight:600;text-align:left}
        th:not(:first-child){text-align:right}
        tfoot td{border-top:2px solid #374151;font-weight:700}
      </style></head><body>
      <h2>Relatório Financeiro — ${periodLabel[period]}</h2>
      <p>Faturamento: ${formatBRL(totalFaturamento)} &nbsp;|&nbsp; Pedidos: ${totalPedidos} &nbsp;|&nbsp; Ticket Médio: ${formatBRL(ticketMedio)}</p>
      <table>
        <thead><tr><th>Data</th><th style="text-align:right">Pedidos</th><th style="text-align:right">PIX</th><th style="text-align:right">Dinheiro</th><th style="text-align:right">Cartão</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr>
          <td>Total</td>
          <td style="text-align:right">${totalPedidos}</td>
          <td style="text-align:right">${formatBRL(totalPix)}</td>
          <td style="text-align:right">${formatBRL(totalDinheiro)}</td>
          <td style="text-align:right">${formatBRL(totalCartao)}</td>
          <td style="text-align:right">${formatBRL(totalFaturamento)}</td>
        </tr></tfoot>
      </table></body></html>`

    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.print() }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-xl font-bold">Financeiro</h2>
            <p className="text-sm text-muted-foreground capitalize">{periodLabel[period]}</p>
          </div>
          {caixaFechado !== null && (
            caixaFechado ? (
              <Badge variant="outline" className="gap-1 text-green-700 border-green-300 bg-green-50">
                <CheckCircle2 className="h-3 w-3" /> Caixa fechado hoje
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-blue-700 border-blue-300 bg-blue-50">
                <Circle className="h-3 w-3 fill-blue-400" /> Caixa aberto
              </Badge>
            )
          )}
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList>
              <TabsTrigger value="hoje">Hoje</TabsTrigger>
              <TabsTrigger value="semana">7 dias</TabsTrigger>
              <TabsTrigger value="mes">Mês</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={loading || dailyData.length === 0}>
            <Printer className="h-4 w-4 mr-1.5" />
            Relatório
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Carregando…</p>
      ) : (
        <>
          {/* KPIs principais */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" /> Faturamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">{formatBRL(totalFaturamento)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <ShoppingBag className="h-4 w-4" /> Pedidos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{totalPedidos}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <Receipt className="h-4 w-4" /> Ticket Médio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatBRL(ticketMedio)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Breakdown por forma de pagamento */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-green-200 dark:border-green-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <QrCode className="h-4 w-4 text-green-600" /> PIX
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-green-600">{formatBRL(totalPix)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{pct(totalPix, totalFaturamento)} do total</p>
              </CardContent>
            </Card>
            <Card className="border-blue-200 dark:border-blue-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <Banknote className="h-4 w-4 text-blue-600" /> Dinheiro
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-blue-600">{formatBRL(totalDinheiro)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{pct(totalDinheiro, totalFaturamento)} do total</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200 dark:border-amber-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4 text-amber-600" /> Cartão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-amber-600">{formatBRL(totalCartao)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{pct(totalCartao, totalFaturamento)} do total</p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico */}
          {dailyData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Faturamento por Dia</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dailyData} barSize={period === 'hoje' ? 40 : undefined}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                    <XAxis
                      dataKey="dia"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(d) => format(new Date(d + 'T00:00:00'), 'dd/MM', { locale: ptBR })}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `R$${v}`}
                      tick={{ fontSize: 11 }}
                      width={60}
                    />
                    <Tooltip
                      formatter={(v: number, name: string) => [formatBRL(v), name]}
                      labelFormatter={(label) => format(new Date(label + 'T00:00:00'), "dd 'de' MMMM", { locale: ptBR })}
                      contentStyle={{ fontSize: 13 }}
                    />
                    <Legend iconType="circle" iconSize={8} />
                    <Bar dataKey="pix" name="PIX" fill="#22c55e" stackId="a" />
                    <Bar dataKey="dinheiro" name="Dinheiro" fill="#3b82f6" stackId="a" />
                    <Bar dataKey="cartao" name="Cartão" fill="#f59e0b" stackId="a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Tabela resumo diária */}
          {dailyData.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resumo Diário</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                        <th className="text-left px-4 py-2 font-medium">Data</th>
                        <th className="text-right px-4 py-2 font-medium">Pedidos</th>
                        <th className="text-right px-4 py-2 font-medium">PIX</th>
                        <th className="text-right px-4 py-2 font-medium">Dinheiro</th>
                        <th className="text-right px-4 py-2 font-medium">Cartão</th>
                        <th className="text-right px-4 py-2 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...dailyData].reverse().map((d) => (
                        <tr key={d.dia} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-2.5 font-medium capitalize">
                            {format(new Date(d.dia + 'T00:00:00'), "EEE, dd/MM", { locale: ptBR })}
                          </td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground">{d.pedidos}</td>
                          <td className="px-4 py-2.5 text-right text-green-600">{d.pix > 0 ? formatBRL(d.pix) : '—'}</td>
                          <td className="px-4 py-2.5 text-right text-blue-600">{d.dinheiro > 0 ? formatBRL(d.dinheiro) : '—'}</td>
                          <td className="px-4 py-2.5 text-right text-amber-600">{d.cartao > 0 ? formatBRL(d.cartao) : '—'}</td>
                          <td className="px-4 py-2.5 text-right font-semibold">{formatBRL(d.faturamento)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/30 font-semibold">
                        <td className="px-4 py-2.5">Total</td>
                        <td className="px-4 py-2.5 text-right">{totalPedidos}</td>
                        <td className="px-4 py-2.5 text-right text-green-600">{formatBRL(totalPix)}</td>
                        <td className="px-4 py-2.5 text-right text-blue-600">{formatBRL(totalDinheiro)}</td>
                        <td className="px-4 py-2.5 text-right text-amber-600">{formatBRL(totalCartao)}</td>
                        <td className="px-4 py-2.5 text-right text-primary">{formatBRL(totalFaturamento)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
