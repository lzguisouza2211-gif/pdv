import { useEffect, useState, useCallback } from 'react'
import { fetchDeliveryFee } from '@/services/api/deliveryFee.service'
import { supabase } from '@/services/supabaseClient'

export function useDeliveryFee() {
  const [fee, setFee] = useState<number>(5)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const value = await fetchDeliveryFee()
      setFee(value)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()

    const interval = setInterval(load, 30_000)

    const channel = supabase
      .channel('delivery-config-watch')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'delivery_config' }, load)
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [load])

  return { fee, loading, reload: load }
}
