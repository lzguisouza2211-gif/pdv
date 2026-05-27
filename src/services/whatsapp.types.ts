/** Status de pedido no formato esperado pelo backend Baileys. */
export type OrderStatus =
  | 'confirmed'
  | 'preparing'
  | 'out_for_delivery'
  | 'ready_for_pickup'
  | 'cancelled'
