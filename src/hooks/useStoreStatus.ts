import { useEffect, useState, useCallback } from 'react'
import { StoreStatus } from '@/types'
import { fetchStoreStatus } from '@/services/api/storeStatus.service'
import { supabase } from '@/services/supabaseClient'

export function useStoreStatus() {
  const [status, setStatus] = useState<StoreStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await fetchStoreStatus()
      setStatus(data)
    } catch (err) {
      console.error('Erro ao carregar status da loja', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()

    const interval = setInterval(load, 5_000)

    const channel = supabase
      .channel('store-status')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'store_status' }, load)
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [load])

  return { status, loading, reload: load }
}
