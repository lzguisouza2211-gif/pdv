import type { OrderNotificationPayload } from './types.js'

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function totalLine(total?: number): string {
  return total != null ? `\n💰 Total: *${BRL.format(total)}*` : ''
}

export const MessageTemplates = {
  confirmed(p: OrderNotificationPayload): string {
    const time = p.estimatedTime ?? 30
    const itemsBlock = p.items && p.items.length > 0
      ? [``, `🛒 *Itens:*`, ...p.items]
      : []
    return [
      `✅ *Pedido #${p.orderId} confirmado!*`,
      ``,
      `Olá, *${p.customerName}*! 👋`,
      `Seu pedido foi recebido e já entrou na fila de preparo.`,
      ...itemsBlock,
      ``,
      `⏱️ Tempo estimado: *${time} minutos*${totalLine(p.total)}`,
      ``,
      `Obrigado por escolher a gente! 🍔`,
    ].join('\n')
  },

  preparing(p: OrderNotificationPayload): string {
    return [
      `👨‍🍳 *Pedido #${p.orderId} em preparo!*`,
      ``,
      `${p.customerName}, sua comanda está na cozinha.`,
      `Em breve ficará prontinho! 🔥`,
    ].join('\n')
  },

  outForDelivery(p: OrderNotificationPayload): string {
    return [
      `🛵 *Pedido #${p.orderId} saiu para entrega!*`,
      ``,
      `Boa notícia, *${p.customerName}*!`,
      `Seu pedido está a caminho. Fique de olho na porta! 📍`,
    ].join('\n')
  },

  readyForPickup(p: OrderNotificationPayload): string {
    return [
      `🎉 *Pedido #${p.orderId} pronto para retirada!*`,
      ``,
      `*${p.customerName}*, pode vir buscar!`,
      `Seu pedido está te esperando aqui. 🏃`,
    ].join('\n')
  },

  cancelled(p: OrderNotificationPayload): string {
    return [
      `❌ *Pedido #${p.orderId} cancelado*`,
      ``,
      `Olá, ${p.customerName}.`,
      `Infelizmente seu pedido precisou ser cancelado.`,
      `Entre em contato para mais informações.`,
    ].join('\n')
  },
}
