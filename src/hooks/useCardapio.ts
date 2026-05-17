import { useEffect, useState, useCallback } from 'react'
import { ItemCardapio, IngredienteIndisponivel } from '@/types'
import { fetchCardapio } from '@/services/api/cardapio.service'
import { fetchIngredientesIndisponiveis } from '@/services/api/ingredientes.service'
import { supabase } from '@/services/supabaseClient'

export function useCardapio() {
  const [itens, setItens] = useState<ItemCardapio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [cardapioData, indisponiveis] = await Promise.all([
        fetchCardapio(),
        fetchIngredientesIndisponiveis(),
      ])

      const indisponiveisList = indisponiveis
        .filter((i: IngredienteIndisponivel) => i.indisponivel)
        .map((i: IngredienteIndisponivel) => i.ingrediente)

      const enriched = cardapioData.map((item) => ({
        ...item,
        ingredientes_indisponiveis: item.ingredientes.filter((ing) =>
          indisponiveisList.includes(ing)
        ),
      }))

      setItens(enriched)
      setError(null)
    } catch (err) {
      setError('Erro ao carregar cardápio')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()

    let realtimeOk = false
    const realtimeTimeout = setTimeout(() => {
      if (!realtimeOk) {
        const interval = setInterval(load, 5_000)
        return () => clearInterval(interval)
      }
    }, 10_000)

    const channel = supabase
      .channel('cardapio-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cardapio' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredientes_indisponiveis_dia' }, load)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') realtimeOk = true
      })

    return () => {
      clearTimeout(realtimeTimeout)
      supabase.removeChannel(channel)
    }
  }, [load])

  return { itens, loading, error, reload: load }
}
