import type { Request, Response } from 'express'
import { getSupabaseAdmin } from '../services/supabase/client.js'
import { logger } from '../utils/logger.js'

function handleError(res: Response, err: unknown, context: string): void {
  const message = err instanceof Error ? err.message : String(err)
  logger.error(`[CONV] ${context}: ${message}`)
  res.status(500).json({ ok: false, error: 'Erro interno do servidor' })
}

export const ConversationController = {

  /** GET /whatsapp/conversas — lista conversas ordenadas pela mais recente. Só para verificação manual na Fase 0. */
  async list(_req: Request, res: Response): Promise<void> {
    try {
      const { data, error } = await getSupabaseAdmin()
        .from('conversas_ia')
        .select('id, phone, modo, motivo_transferencia, ultima_atividade_at, criado_at')
        .order('ultima_atividade_at', { ascending: false })
        .limit(50)

      if (error) throw new Error(error.message)
      res.json({ ok: true, conversas: data })
    } catch (err) {
      handleError(res, err, 'list')
    }
  },

  /** GET /whatsapp/conversas/:phone/mensagens — histórico de uma conversa. */
  async messages(req: Request, res: Response): Promise<void> {
    const { phone } = req.params

    try {
      const { data: conversa, error: convError } = await getSupabaseAdmin()
        .from('conversas_ia')
        .select('id')
        .eq('phone', phone)
        .maybeSingle()

      if (convError) throw new Error(convError.message)
      if (!conversa) {
        res.status(404).json({ ok: false, error: 'Conversa não encontrada' })
        return
      }

      const { data, error } = await getSupabaseAdmin()
        .from('mensagens_ia')
        .select('id, direcao, autor, conteudo, tool_calls, criado_at')
        .eq('conversa_id', conversa.id)
        .order('criado_at', { ascending: true })

      if (error) throw new Error(error.message)
      res.json({ ok: true, mensagens: data })
    } catch (err) {
      handleError(res, err, 'messages')
    }
  },
}
