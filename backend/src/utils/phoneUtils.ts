/**
 * Normaliza um número brasileiro para o formato JID do WhatsApp.
 * Entrada:  "11987654321", "(11) 98765-4321", "5511987654321"
 * Saída:    "5511987654321@s.whatsapp.net"
 */
export function toWhatsAppJid(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`
  return `${withCountry}@s.whatsapp.net`
}

/**
 * Valida se o número é um celular brasileiro válido.
 * Aceita: 55 + DDD (2) + 8 ou 9 dígitos = 12 ou 13 dígitos totais.
 */
export function isValidBrazilPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`
  return withCountry.length >= 12 && withCountry.length <= 13
}

/** Formata número para exibição em logs: "5511987654321" → "+55 11 98765-4321" */
export function formatPhoneForLog(phone: string): string {
  const digits = phone.replace(/\D/g, '').replace(/^55/, '')
  if (digits.length === 11) {
    return `+55 ${digits.slice(0, 2)} ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `+55 ${digits.slice(0, 2)} ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `+55 ${digits}`
}
