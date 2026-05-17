import { useEffect, useState } from 'react'
import { fetchDeliveryFee } from '@/services/api/deliveryFee.service'

export function useDeliveryFee() {
  const [fee, setFee] = useState<number>(5)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDeliveryFee()
      .then(setFee)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return { fee, loading }
}
