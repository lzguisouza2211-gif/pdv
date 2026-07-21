import { useEffect, useState } from 'react'
import { fetchItensMaisVendidos } from '@/services/api/pedidos.service'

export function useTopVendidos(days = 30, limit = 5) {
  const [topNomes, setTopNomes] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchItensMaisVendidos(days, limit)
      .then((ranking) => { if (!cancelled) setTopNomes(ranking.map((r) => r.nome)) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [days, limit])

  return { topNomes, loaded }
}
