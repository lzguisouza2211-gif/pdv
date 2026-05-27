export function toWhatsAppJid(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`
  return `${withCountry}@s.whatsapp.net`
}

export function isValidBrazilPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`
  return withCountry.length >= 12 && withCountry.length <= 13
}

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
