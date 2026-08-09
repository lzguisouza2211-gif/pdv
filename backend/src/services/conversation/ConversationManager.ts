import { getSupabaseAdmin } from '../supabase/client.js'
import { logger } from '../../utils/logger.js'
import { formatPhoneForLog } from '../../utils/phoneUtils.js'
import type { InboundMessage } from '../whatsapp/types.js'

// Conversa sem atividade há mais tempo que isso é tratada como sessão nova
// (reseta modo para 'ia' se estava em 'humano') — decisão registrada em
// docs/atendente-ia-arquitetura.md, seção 10 e 13.
const SESSION_TIMEOUT_MS = 60 * 60 * 1000

interface ConversaRow {
  id: number
  phone: string
  modo: 'ia' | 'humano'
  ultima_atividade_at: string
}

/**
 * Fase 0: só persiste o estado de conversa e o histórico bruto de mensagens.
 * Não chama nenhum LLM ainda — isso entra na Fase 1.
 */
export class ConversationManager {
  private get db() {
    return getSupabaseAdmin()
  }

  /** Ponto de entrada: chamado para cada InboundMessage emitido pelo BaileysClient. */
  async handleInbound(msg: InboundMessage): Promise<void> {
    const conversa = await this.findOrResetConversa(msg.phone)

    await this.db
      .from('conversas_ia')
      .update({ ultima_atividade_at: new Date().toISOString() })
      .eq('id', conversa.id)

    const conteudo = msg.text || (msg.hasMedia ? '[mídia recebida]' : '')

    const { error } = await this.db.from('mensagens_ia').insert({
      conversa_id: conversa.id,
      direcao: 'entrada',
      autor: 'cliente',
      conteudo,
    })

    if (error) {
      logger.error(`[CONV] Falha ao persistir mensagem de ${formatPhoneForLog(msg.phone)}: ${error.message}`)
      return
    }

    logger.info(
      `[CONV] ← ${formatPhoneForLog(msg.phone)} (modo: ${conversa.modo}): ${conteudo.slice(0, 80)}`
    )
  }

  /** Busca a conversa do telefone; cria se não existir; reseta se expirada. */
  private async findOrResetConversa(phone: string): Promise<ConversaRow> {
    const { data: existing, error: selectError } = await this.db
      .from('conversas_ia')
      .select('id, phone, modo, ultima_atividade_at')
      .eq('phone', phone)
      .maybeSingle<ConversaRow>()

    if (selectError) {
      throw new Error(`Falha ao consultar conversa (${phone}): ${selectError.message}`)
    }

    if (!existing) {
      const { data: created, error: insertError } = await this.db
        .from('conversas_ia')
        .insert({ phone })
        .select('id, phone, modo, ultima_atividade_at')
        .single<ConversaRow>()

      if (insertError || !created) {
        throw new Error(`Falha ao criar conversa (${phone}): ${insertError?.message}`)
      }

      logger.info(`[CONV] Nova conversa criada para ${formatPhoneForLog(phone)}`)
      return created
    }

    const inativaHaMs = Date.now() - new Date(existing.ultima_atividade_at).getTime()
    if (inativaHaMs > SESSION_TIMEOUT_MS && existing.modo !== 'ia') {
      const { data: updated, error: updateError } = await this.db
        .from('conversas_ia')
        .update({ modo: 'ia', motivo_transferencia: null })
        .eq('id', existing.id)
        .select('id, phone, modo, ultima_atividade_at')
        .single<ConversaRow>()

      if (updateError || !updated) {
        throw new Error(`Falha ao resetar conversa expirada (${phone}): ${updateError?.message}`)
      }

      logger.info(`[CONV] Sessão de ${formatPhoneForLog(phone)} expirou (>60min) — modo resetado para 'ia'`)
      return updated
    }

    return existing
  }
}
