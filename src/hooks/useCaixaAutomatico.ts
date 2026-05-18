import { useEffect, useRef, useCallback } from 'react'
import { format } from 'date-fns'
import { supabase } from '@/services/supabaseClient'
import { fetchPedidos } from '@/services/api/pedidos.service'
import { useToast } from '@/hooks/use-toast'
import { formatBRL } from '@/utils/calc'

const STORAGE_KEY = 'pdv_caixa_data_aberta'

export async function fecharDia(data: string, userId: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('fechamentos_caixa')
    .select('id')
    .eq('data', data)
    .maybeSingle()

  if (existing) return false // already closed

  const pedidos = await fetchPedidos({ startDate: data, endDate: data, status: 'Finalizado' })
  if (pedidos.length === 0) return false // no orders, nothing to register

  const total = pedidos.reduce((s, p) => s + p.total, 0)
  const pix = pedidos.filter(p => p.formapagamento === 'pix')
  const dinheiro = pedidos.filter(p => p.formapagamento === 'dinheiro')
  const cartao = pedidos.filter(p => p.formapagamento === 'cartao')

  const { error } = await supabase.from('fechamentos_caixa').insert([{
    data,
    periodo: 'dia',
    total,
    total_pedidos: pedidos.length,
    pix_valor: pix.reduce((s, p) => s + p.total, 0),
    pix_quantidade: pix.length,
    dinheiro_valor: dinheiro.reduce((s, p) => s + p.total, 0),
    dinheiro_quantidade: dinheiro.length,
    cartao_valor: cartao.reduce((s, p) => s + p.total, 0),
    cartao_quantidade: cartao.length,
    created_by: userId,
  }])

  if (error) throw error
  return true
}

export async function caixaEstaFechado(data: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('fechamentos_caixa')
    .select('id')
    .eq('data', data)
    .maybeSingle()
  return !!existing
}

// Called from AdminLayout so it runs on every admin page
export function useCaixaAutomatico(userId: string | undefined) {
  const { toast } = useToast()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const verificar = useCallback(async () => {
    if (!userId) return

    const hoje = format(new Date(), 'yyyy-MM-dd')
    const dataAnterior = localStorage.getItem(STORAGE_KEY)

    if (dataAnterior && dataAnterior !== hoje) {
      try {
        const fechou = await fecharDia(dataAnterior, userId)
        if (fechou) {
          // We need to get the total to show in toast — re-query the fechamento we just inserted
          const { data: registro } = await supabase
            .from('fechamentos_caixa')
            .select('total, total_pedidos')
            .eq('data', dataAnterior)
            .maybeSingle()

          toast({
            title: 'Caixa fechado automaticamente',
            description: registro
              ? `${dataAnterior} · ${registro.total_pedidos} pedidos · ${formatBRL(registro.total)}`
              : `Caixa de ${dataAnterior} registrado.`,
          })
        }
      } catch (err) {
        console.error('Erro ao fechar caixa automático:', err)
      }
    }

    localStorage.setItem(STORAGE_KEY, hoje)
  }, [userId, toast])

  useEffect(() => {
    verificar()

    // Detect midnight crossing every 60s
    timerRef.current = setInterval(() => {
      const hoje = format(new Date(), 'yyyy-MM-dd')
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored && stored !== hoje) verificar()
    }, 60_000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [verificar])
}
