import { supabase } from '@/services/supabaseClient'

export async function registrarAuditoria(
  acao: string,
  detalhes?: Record<string, unknown>,
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_log').insert({
      user_id:    user?.id    ?? null,
      user_email: user?.email ?? null,
      acao,
      detalhes:   detalhes ?? null,
    })
  } catch {
    // Falhas de auditoria nunca bloqueiam o fluxo principal
  }
}
