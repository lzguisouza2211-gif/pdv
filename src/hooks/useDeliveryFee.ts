import { useEffect, useState, useCallback } from 'react'
import { fetchDeliveryFee, fetchDeliveryFees } from '@/services/api/deliveryFee.service'
import { supabase } from '@/services/supabaseClient'
import { DeliveryFeeOption } from '@/types'

export function useDeliveryFee() {
  const [fee, setFee] = useState<number>(5)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const value = await fetchDeliveryFee()
      setFee(value)
    } catch (err) {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()

    const interval = setInterval(load, 10_000)

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

export function useDeliveryFees() {
  const [bairros, setBairros] = useState<DeliveryFeeOption[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const value = await fetchDeliveryFees()
      setBairros(value)
    } catch (err) {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()

    const interval = setInterval(load, 10_000)

    const channel = supabase
      .channel('delivery-fees-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_fees' }, load)
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [load])

  return { bairros, loading, reload: load }
}
