const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3000'

function normalizarTelefone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  // garante prefixo 55 (Brasil) sem duplicar
  return digits.startsWith('55') ? digits : `55${digits}`
}

export async function enviarNotificacaoWpp(phone: string | undefined, message: string): Promise<void> {
  if (!phone) return
  const normalized = normalizarTelefone(phone)
  // mínimo: 55 + DDD (2) + número (8) = 12 dígitos
  if (normalized.length < 12) return

  try {
    await fetch(`${BACKEND_URL}/send-whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: normalized, message }),
    })
  } catch {
    // notificação WPP é best-effort — nunca bloqueia o fluxo do pedido
  }
}
