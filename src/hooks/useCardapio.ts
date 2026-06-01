import { useEffect, useState, useCallback } from 'react'
import { ItemCardapio, IngredienteIndisponivel } from '@/types'
import { fetchCardapio } from '@/services/api/cardapio.service'
import { fetchIngredientesIndisponiveis } from '@/services/api/ingredientes.service'
import { supabase } from '@/services/supabaseClient'

// Polling de segurança — garante atualização mesmo sem Realtime configurado
const HEARTBEAT_MS = 10_000

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
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()

    // Polling de segurança — cobre quando Realtime não está habilitado na tabela
    const heartbeat = setInterval(load, HEARTBEAT_MS)

    // Recarrega quando o usuário volta para a aba
    function onVisible() {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)

    // Realtime para atualizações instantâneas (requer REPLICA IDENTITY FULL no Supabase)
    const channel = supabase
      .channel('cardapio-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cardapio' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredientes_indisponiveis_dia' }, load)
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') load()
      })

    return () => {
      clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [load])

  return { itens, loading, error, reload: load }
}
