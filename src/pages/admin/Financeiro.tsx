import { useEffect, useState, useCallback } from 'react'
import { fetchPedidos } from '@/services/api/pedidos.service'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { formatBRL } from '@/utils/calc'
import {
  format, startOfMonth, subDays, subMonths, getDaysInMonth, getDate, getHours, getDay,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { caixaEstaFechado } from '@/hooks/useCaixaAutomatico'
import {
  TrendingUp, ShoppingBag, Receipt, QrCode, Banknote, CreditCard,
  CheckCircle2, Circle, Printer, ArrowUpRight, ArrowDownRight, Minus,
  Clock, Star, Target, XCircle,
} from 'lucide-react'
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

type HourlyData = {
  hora: string
  pedidos: number
}

type WeekdayData = {
  dia: string
  diaCurto: string
  faturamento: number
  pedidos: number
}

type TopProduct = {
  nome: string
  quantidade: number
  total: number
}

type DeltaResult = { value: number; direction: 'up' | 'down' | 'flat' }

const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const WEEKDAYS_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function getDateRange(period: Period): { start: string; end: string } {
  const today = new Date()
  const end = format(today, 'yyyy-MM-dd')
  if (period === 'hoje') return { start: end, end }
  if (period === 'semana') return { start: format(subDays(today, 6), 'yyyy-MM-dd'), end }
  return { start: format(startOfMonth(today), 'yyyy-MM-dd'), end }
}

function getPrevDateRange(period: Period): { start: string; end: string } {
  const today = new Date()
  if (period === 'hoje') {
    const y = format(subDays(today, 1), 'yyyy-MM-dd')
    return { start: y, end: y }
  }
  if (period === 'semana') {
    return {
      start: format(subDays(today, 13), 'yyyy-MM-dd'),
      end: format(subDays(today, 7), 'yyyy-MM-dd'),
    }
  }
  const last = subMonths(today, 1)
  return {
    start: format(startOfMonth(last), 'yyyy-MM-dd'),
    end: format(new Date(last.getFullYear(), last.getMonth() + 1, 0), 'yyyy-MM-dd'),
  }
}

function pct(value: number, total: number) {
  if (total === 0) return '0%'
  return `${Math.round((value / total) * 100)}%`
}

function calcDelta(current: number, prev: number): DeltaResult {
  if (prev === 0) return { value: 0, direction: 'flat' }
  const d = ((current - prev) / prev) * 100
  return { value: Math.abs(d), direction: d > 1 ? 'up' : d < -1 ? 'down' : 'flat' }
}

function DeltaBadge({ d, label }: { d: DeltaResult; label: string }) {
  if (d.direction === 'flat') return (
    <span className="text-xs text-muted-foreground flex items-center gap-0.5">
      <Minus className="h-3 w-3" /> Estável {label}
    </span>
  )
  const up = d.direction === 'up'
  return (
    <span className={`text-xs flex items-center gap-0.5 ${up ? 'text-green-600' : 'text-red-500'}`}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {d.value.toFixed(1)}% {label}
    </span>
  )
}

function SkeletonCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="h-4 w-28 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="h-7 w-32 bg-muted animate-pulse rounded" />
        <div className="h-3 w-24 bg-muted animate-pulse rounded" />
      </CardContent>
    </Card>
  )
}

export function Financeiro() {
  const [period, setPeriod] = useState<Period>('mes')
  const [dailyData, setDailyData] = useState<DailyData[]>([])
  const [prevTotal, setPrevTotal] = useState(0)
  const [prevPedidos, setPrevPedidos] = useState(0)
  const [cancelados, setCancelados] = useState(0)
  const [totalBruto, setTotalBruto] = useState(0)
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([])
  const [weekdayData, setWeekdayData] = useState<WeekdayData[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [caixaFechado, setCaixaFechado] = useState<boolean | null>(null)

  const hoje = format(new Date(), 'yyyy-MM-dd')

  const loadData = useCallback(async (p: Period) => {
    setLoading(true)
    setErro(null)
    try {
      const { start, end } = getDateRange(p)
      const prevRange = getPrevDateRange(p)

      const [todosPedidos, prevRaw] = await Promise.all([
        fetchPedidos({ startDate: start, endDate: end }),
        fetchPedidos({ startDate: prevRange.start, endDate: prevRange.end }),
      ])

      const canceled = todosPedidos.filter(o => o.status === 'Cancelado')
      setCancelados(canceled.length)
      setTotalBruto(todosPedidos.length)

      const pedidos = todosPedidos.filter(o => o.status !== 'Cancelado')
      const prevValid = prevRaw.filter(o => o.status !== 'Cancelado')

      setPrevTotal(prevValid.reduce((s, o) => s + o.total, 0))
      setPrevPedidos(prevValid.length)

      // Daily aggregation
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
      setDailyData(Array.from(map.values()).sort((a, b) => a.dia.localeCompare(b.dia)))

      // Hourly distribution
      const hourMap = new Map<number, number>()
      for (const pedido of pedidos) {
        const h = getHours(new Date(pedido.created_at))
        hourMap.set(h, (hourMap.get(h) ?? 0) + 1)
      }
      setHourlyData(
        Array.from({ length: 24 }, (_, i) => ({
          hora: `${String(i).padStart(2, '0')}h`,
          pedidos: hourMap.get(i) ?? 0,
        })).filter(h => h.pedidos > 0)
      )

      // Weekday distribution
      const wdMap = new Map<number, { faturamento: number; pedidos: number }>()
      for (const pedido of pedidos) {
        const wd = getDay(new Date(pedido.created_at))
        const existing = wdMap.get(wd) ?? { faturamento: 0, pedidos: 0 }
        wdMap.set(wd, { faturamento: existing.faturamento + pedido.total, pedidos: existing.pedidos + 1 })
      }
      setWeekdayData(
        Array.from({ length: 7 }, (_, i) => ({
          dia: WEEKDAYS_FULL[i],
          diaCurto: WEEKDAYS_SHORT[i],
          faturamento: wdMap.get(i)?.faturamento ?? 0,
          pedidos: wdMap.get(i)?.pedidos ?? 0,
        })).filter(wd => wd.pedidos > 0)
      )

      // Top products
      const prodMap = new Map<string, { quantidade: number; total: number }>()
      for (const pedido of pedidos) {
        const itens = Array.isArray(pedido.itens) ? pedido.itens : []
        for (const item of itens) {
          if (!item?.nome) continue
          const ex = prodMap.get(item.nome) ?? { quantidade: 0, total: 0 }
          const qty = item.quantidade ?? 1
          const price = item.preco ?? 0
          prodMap.set(item.nome, { quantidade: ex.quantidade + qty, total: ex.total + price * qty })
        }
      }
      setTopProducts(
        Array.from(prodMap.entries())
          .map(([nome, v]) => ({ nome, ...v }))
          .sort((a, b) => b.quantidade - a.quantidade)
          .slice(0, 7)
      )
    } catch (err: unknown) {
      const e = err as Record<string, unknown>
      setErro((e?.message as string) ?? 'Erro ao carregar dados financeiros.')
    } finally {
      setLoading(false)
    }
  }, [])

  const checkCaixaStatus = useCallback(async () => {
    setCaixaFechado(await caixaEstaFechado(hoje))
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

  const prevTicketMedio = prevPedidos > 0 ? prevTotal / prevPedidos : 0
  const deltaFat = calcDelta(totalFaturamento, prevTotal)
  const deltaPed = calcDelta(totalPedidos, prevPedidos)
  const deltaTkt = calcDelta(ticketMedio, prevTicketMedio)

  const now = new Date()
  const daysInMonth = getDaysInMonth(now)
  const currentDay = getDate(now)
  const projMonthly = period === 'mes' && currentDay > 0 && totalFaturamento > 0
    ? (totalFaturamento / currentDay) * daysInMonth
    : 0

  const cancelRate = totalBruto > 0 ? Math.round((cancelados / totalBruto) * 100) : 0

  const periodLabel: Record<Period, string> = {
    hoje: 'Hoje',
    semana: 'Últimos 7 dias',
    mes: format(now, 'MMMM yyyy', { locale: ptBR }),
  }

  const prevPeriodLabel: Record<Period, string> = {
    hoje: 'vs ontem',
    semana: 'vs 7 dias ant.',
    mes: 'vs mês passado',
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

    const topRows = topProducts.map((p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${p.nome}</td>
        <td style="text-align:right">${p.quantidade}</td>
        <td style="text-align:right;font-weight:600">${formatBRL(p.total)}</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório — ${periodLabel[period]}</title>
      <style>
        body{font-family:sans-serif;padding:24px;color:#111}
        h2{margin:0 0 4px}h3{margin:24px 0 8px;font-size:14px}
        p{margin:0 0 16px;color:#555;font-size:13px}
        table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:8px}
        th,td{padding:8px 10px;border-bottom:1px solid #e5e7eb}
        th{background:#f9fafb;font-weight:600;text-align:left}
        th:not(:first-child){text-align:right}
        tfoot td{border-top:2px solid #374151;font-weight:700}
      </style></head><body>
      <h2>Relatório Financeiro — ${periodLabel[period]}</h2>
      <p>Faturamento: ${formatBRL(totalFaturamento)} &nbsp;|&nbsp; Pedidos: ${totalPedidos} &nbsp;|&nbsp; Ticket Médio: ${formatBRL(ticketMedio)}${projMonthly > totalFaturamento ? ` &nbsp;|&nbsp; Projeção mensal: ${formatBRL(projMonthly)}` : ''}</p>
      <h3>Resumo Diário</h3>
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
      </table>
      ${topRows ? `<h3>Produtos Mais Vendidos</h3><table><thead><tr><th>#</th><th>Produto</th><th style="text-align:right">Qtd</th><th style="text-align:right">Total</th></tr></thead><tbody>${topRows}</tbody></table>` : ''}
      </body></html>`

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
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      ) : erro ? (
        <p className="text-destructive text-sm font-medium">{erro}</p>
      ) : (
        <>
          {/* KPIs com comparação vs período anterior */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" /> Faturamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-2xl font-bold text-primary">{formatBRL(totalFaturamento)}</p>
                <DeltaBadge d={deltaFat} label={prevPeriodLabel[period]} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <ShoppingBag className="h-4 w-4" /> Pedidos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-2xl font-bold">{totalPedidos}</p>
                <DeltaBadge d={deltaPed} label={prevPeriodLabel[period]} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <Receipt className="h-4 w-4" /> Ticket Médio
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-2xl font-bold">{formatBRL(ticketMedio)}</p>
                <DeltaBadge d={deltaTkt} label={prevPeriodLabel[period]} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <XCircle className="h-4 w-4 text-red-400" /> Cancelamentos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-2xl font-bold">{cancelados}</p>
                <span className="text-xs text-muted-foreground">{cancelRate}% dos pedidos</span>
              </CardContent>
            </Card>
          </div>

          {/* Projeção mensal */}
          {period === 'mes' && projMonthly > totalFaturamento && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Target className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                      Projeção para {format(now, 'MMMM', { locale: ptBR })}
                    </p>
                    <p className="text-2xl font-bold text-primary">{formatBRL(projMonthly)}</p>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <p className="text-muted-foreground text-xs">Média diária atual</p>
                  <p className="font-semibold">{formatBRL(totalFaturamento / currentDay)}/dia</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {currentDay} de {daysInMonth} dias decorridos
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

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
                <div className="mt-2 h-1.5 w-full bg-muted rounded-full">
                  <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: pct(totalPix, totalFaturamento) }} />
                </div>
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
                <div className="mt-2 h-1.5 w-full bg-muted rounded-full">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: pct(totalDinheiro, totalFaturamento) }} />
                </div>
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
                <div className="mt-2 h-1.5 w-full bg-muted rounded-full">
                  <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: pct(totalCartao, totalFaturamento) }} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico faturamento por dia */}
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
                      labelFormatter={(label) => format(new Date(label + 'T00:00:00'), "EEE, dd 'de' MMMM", { locale: ptBR })}
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

          {/* Horário de pico + Melhor dia da semana */}
          {period !== 'hoje' && (hourlyData.length > 0 || weekdayData.length > 1) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {hourlyData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-4 w-4 text-violet-500" /> Horário de Pico
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={hourlyData} barSize={14}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                        <XAxis dataKey="hora" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} width={24} />
                        <Tooltip
                          formatter={(v: number) => [v, 'Pedidos']}
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Bar dataKey="pedidos" name="Pedidos" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    {hourlyData.length > 0 && (() => {
                      const peak = hourlyData.reduce((a, b) => b.pedidos > a.pedidos ? b : a)
                      return (
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                          Pico: <span className="font-semibold text-violet-600">{peak.hora}</span> com {peak.pedidos} pedidos
                        </p>
                      )
                    })()}
                  </CardContent>
                </Card>
              )}

              {weekdayData.length > 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Star className="h-4 w-4 text-orange-500" /> Faturamento por Dia da Semana
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={[...weekdayData].sort((a, b) => {
                          const order = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
                          return order.indexOf(a.diaCurto) - order.indexOf(b.diaCurto)
                        })}
                        barSize={24}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                        <XAxis dataKey="diaCurto" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                        <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} tick={{ fontSize: 10 }} width={52} />
                        <Tooltip
                          formatter={(v: number) => [formatBRL(v), 'Faturamento']}
                          labelFormatter={(l) => weekdayData.find(d => d.diaCurto === l)?.dia ?? l}
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Bar dataKey="faturamento" name="Faturamento" fill="#f97316" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    {weekdayData.length > 0 && (() => {
                      const best = weekdayData.reduce((a, b) => b.faturamento > a.faturamento ? b : a)
                      return (
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                          Melhor dia: <span className="font-semibold text-orange-600">{best.dia}</span> — {formatBRL(best.faturamento)}
                        </p>
                      )
                    })()}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Produtos mais vendidos */}
          {topProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500" /> Produtos Mais Vendidos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {topProducts.map((p, i) => (
                    <div key={p.nome} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                      <span className={`text-sm font-bold w-5 text-center ${i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-amber-700' : 'text-muted-foreground'}`}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.nome}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="h-1.5 flex-1 bg-muted rounded-full max-w-[120px]">
                            <div
                              className="h-full bg-amber-400 rounded-full"
                              style={{ width: `${Math.round((p.quantidade / topProducts[0].quantidade) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{p.quantidade}x</span>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-right shrink-0">{formatBRL(p.total)}</p>
                    </div>
                  ))}
                </div>
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
