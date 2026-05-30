/**
 * Handlers IPC para WhatsApp — Etapa 2
 *
 * Este módulo faz a ponte entre o processo renderer (interface do usuário) e o
 * processo main do Electron, expondo os recursos de WhatsApp via IPC (Inter-Process
 * Communication). Segue o modelo seguro do Electron: o renderer nunca acessa o Node.js
 * diretamente; em vez disso, invoca canais IPC que são tratados aqui.
 *
 * ─── Canais renderer → main (ipcRenderer.invoke / ipcMain.handle) ────────────
 *   whatsapp:status         → retorna { connected, state, uptime }
 *   whatsapp:send           → envia mensagem de texto; recebe { phone, message }
 *   whatsapp:notify-order   → envia notificação de pedido formatada; recebe payload completo
 *   whatsapp:disconnect     → desconecta o cliente e impede auto-reconexão
 *   whatsapp:reconnect      → reinicia a conexão manualmente
 *   whatsapp:clear-session  → apaga os arquivos de sessão locais (força novo QR)
 *
 * ─── Canais main → renderer (webContents.send / ipcRenderer.on) ──────────────
 *   whatsapp:qr             → { qrDataUrl: string }  imagem PNG em base64 para exibir no <img>
 *   whatsapp:connected      → {}  sinaliza que a conexão foi estabelecida
 *   whatsapp:disconnected   → { statusCode, reason }  sinaliza desconexão ou falha
 *   whatsapp:logout         → {}  sinaliza que o dispositivo foi desconectado pelo WhatsApp
 *   whatsapp:status-changed → WhatsAppStatus  atualização de estado completo (polling da UI)
 */

import { ipcMain, BrowserWindow } from 'electron'
import qrcode from 'qrcode'
import type { BaileysClient } from '../services/whatsapp/BaileysClient.js'
import type { WhatsAppService } from '../services/whatsapp/WhatsAppService.js'
import type { OrderNotificationPayload, SendMessagePayload } from '../services/whatsapp/types.js'
import { logger } from '../logger.js'

/**
 * Envia uma mensagem para TODAS as janelas abertas do Electron.
 *
 * O Electron pode ter múltiplas BrowserWindows abertas ao mesmo tempo (ex.: janela
 * principal + janela de configurações). Esta função percorre todas elas e entrega
 * o evento via webContents.send, que o renderer escuta com ipcRenderer.on.
 *
 * A guarda `!win.isDestroyed()` evita erros ao tentar enviar para janelas que já
 * foram fechadas mas ainda não foram removidas da lista pelo garbage collector.
 *
 * @param channel - Nome do canal IPC (ex.: 'whatsapp:qr')
 * @param data    - Dados serializáveis (objeto, string, número, etc.)
 */
function broadcast(channel: string, data: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, data)
  }
}

/**
 * Atalho para transmitir o status atual do WhatsApp para todas as janelas.
 *
 * Chamado sempre que o estado muda (conectado, desconectado, reconectando…) para
 * garantir que a interface do usuário reflita o estado real em tempo real, sem
 * precisar de polling manual.
 *
 * @param service - Instância do WhatsAppService que detém o estado atual
 */
function broadcastStatus(service: WhatsAppService): void {
  broadcast('whatsapp:status-changed', service.getStatus())
}

/**
 * Registra todos os handlers IPC relacionados ao WhatsApp no processo main.
 *
 * Deve ser chamado uma única vez durante a inicialização do app (em main.ts),
 * após a criação do BaileysClient e do WhatsAppService. Os handlers ficam ativos
 * enquanto o processo main estiver rodando — não há cleanup necessário para o
 * ciclo de vida normal do app.
 *
 * @param service - Camada de serviço que encapsula a lógica de negócios do WhatsApp
 * @param client  - Cliente Baileys que gerencia a conexão WebSocket com o WhatsApp
 */
export function registerWhatsAppIpcHandlers(
  service: WhatsAppService,
  client: BaileysClient
): void {
  // ─── Renderer → Main ───────────────────────────────────────────────────────
  // Cada ipcMain.handle registra um canal de requisição-resposta assíncrono.
  // O renderer chama ipcRenderer.invoke(canal, args) e aguarda a Promise retornada.

  /**
   * Retorna o status atual da conexão WhatsApp.
   * Utilizado pela UI para exibir indicadores de estado (conectado, aguardando QR, etc.).
   * Retorna o objeto WhatsAppStatus diretamente do serviço.
   */
  ipcMain.handle('whatsapp:status', () => service.getStatus())

  /**
   * Envia uma mensagem de texto simples para um número de telefone.
   * O payload deve conter { phone, message }. O número deve estar no formato
   * internacional sem '+' (ex.: '5511999999999').
   * Retorna { ok: true } em caso de sucesso; lança exceção em caso de falha.
   */
  ipcMain.handle('whatsapp:send', async (_event, payload: SendMessagePayload) => {
    try {
      await service.sendRaw(payload)
      return { ok: true }
    } catch (err) {
      logger.error('[WPP-IPC]', `Falha ao enviar mensagem para ${payload.phone}`, err)
      throw err
    }
  })

  /**
   * Envia uma notificação de pedido formatada para o cliente.
   * O WhatsAppService monta a mensagem com os dados do pedido (nome do cliente,
   * ID, status, itens, etc.) antes de enviá-la. Usado ao confirmar ou atualizar
   * pedidos no PDV.
   * Retorna { ok: true } em caso de sucesso.
   */
  ipcMain.handle('whatsapp:notify-order', async (_event, payload: OrderNotificationPayload) => {
    try {
      await service.notifyOrder(payload)
      return { ok: true }
    } catch (err) {
      logger.error('[WPP-IPC]', `Falha ao notificar pedido #${payload.orderId} para ${payload.phone}`, err)
      throw err
    }
  })

  /**
   * Desconecta o cliente WhatsApp de forma intencional.
   * Além de encerrar a conexão WebSocket, notifica o renderer com o novo status
   * para que a UI atualize imediatamente (ex.: mostrar botão "Reconectar").
   * Após chamar disconnect(), o BaileysClient NÃO tenta reconectar automaticamente.
   * Retorna { ok: true } após a desconexão.
   */
  ipcMain.handle('whatsapp:disconnect', async () => {
    await client.disconnect()
    broadcastStatus(service)
    return { ok: true }
  })

  /**
   * Reinicia a conexão com o WhatsApp manualmente.
   * Útil quando a conexão cai por instabilidade de rede e o usuário quer forçar
   * uma nova tentativa sem precisar fechar o aplicativo.
   * Retorna { ok: true } após iniciar o processo de reconexão (a conexão em si
   * é assíncrona; o evento 'connected' sinalizará quando estiver pronta).
   */
  ipcMain.handle('whatsapp:reconnect', async () => {
    await client.reconnect()
    return { ok: true }
  })

  /**
   * Apaga os arquivos de sessão salvos localmente (pasta auth_info_baileys/).
   * Ao limpar a sessão, o próximo start exigirá leitura de um novo QR Code,
   * como se fosse o primeiro uso. Necessário quando a sessão fica corrompida
   * ou quando se quer trocar de número/dispositivo.
   * Retorna { ok: true } após a limpeza.
   */
  ipcMain.handle('whatsapp:clear-session', async () => {
    await client.clearSession()
    return { ok: true }
  })

  // ─── Main → Renderer (eventos emitidos pelo BaileysClient) ────────────────
  // O BaileysClient é um EventEmitter. Aqui "escutamos" seus eventos internos
  // e os repassamos para o renderer via broadcast, traduzindo-os para canais IPC.

  /**
   * Evento: novo QR Code disponível para leitura.
   *
   * O WhatsApp gera um QR Code que o usuário precisa escanear com o celular para
   * autenticar o dispositivo. O Baileys entrega a string bruta do QR; aqui ela é
   * convertida para uma data URL PNG em base64 (formato `data:image/png;base64,...`)
   * que pode ser diretamente inserida em uma tag <img> no renderer.
   *
   * Se a conversão falhar (ex.: QR inválido), envia qrDataUrl: null para que a
   * UI exiba uma mensagem de erro em vez de uma imagem quebrada.
   *
   * Opções: margin: 2 (borda branca ao redor), width: 256 (tamanho em pixels).
   */
  client.on('qr', async (rawQr: string) => {
    try {
      const qrDataUrl = await qrcode.toDataURL(rawQr, { margin: 2, width: 256 })
      broadcast('whatsapp:qr', { qrDataUrl })
    } catch (err) {
      console.error('[WPP-IPC] Erro ao gerar QR base64:', err)
      broadcast('whatsapp:qr', { qrDataUrl: null })
    }
    // Atualiza o status para 'awaiting_qr' ou similar, para a UI ajustar o layout
    broadcastStatus(service)
  })

  /**
   * Evento: conexão estabelecida com sucesso.
   * Emitido pelo BaileysClient após o handshake WebSocket ser concluído e a sessão
   * ser validada. A UI deve esconder o QR Code e mostrar o painel de mensagens.
   */
  client.on('connected', () => {
    broadcast('whatsapp:connected', {})
    broadcastStatus(service)
  })

  /**
   * Evento: conexão encerrada inesperadamente ou por comando.
   * O objeto `data` traz o código de status HTTP-like do WhatsApp e uma descrição
   * textual do motivo (ex.: 401 Unauthorized quando a sessão expira no celular).
   * A UI deve exibir o motivo e oferecer opções de reconexão.
   */
  client.on('disconnected', (data: { statusCode: number; reason: string }) => {
    broadcast('whatsapp:disconnected', data)
    broadcastStatus(service)
  })

  /**
   * Evento: logout forçado pelo WhatsApp (celular removeu o dispositivo vinculado).
   * Diferente de 'disconnected', aqui a sessão local não é mais válida — o usuário
   * precisará escanear um novo QR Code. A UI deve limpar qualquer estado de sessão
   * exibido e redirecionar para o fluxo de autenticação.
   */
  client.on('logout', () => {
    broadcast('whatsapp:logout', {})
    broadcastStatus(service)
  })

  /**
   * Evento: número máximo de tentativas de reconexão atingido.
   * O BaileysClient tenta reconectar automaticamente após quedas de conexão.
   * Quando todas as tentativas se esgotam sem sucesso, emite 'max_retries'.
   * Reusamos o canal 'whatsapp:disconnected' com statusCode: -1 (valor sentinela
   * que indica falha por esgotamento de retries, não um código do protocolo WhatsApp)
   * para que a UI possa distinguir e pedir intervenção manual do usuário.
   */
  client.on('max_retries', () => {
    broadcast('whatsapp:disconnected', { statusCode: -1, reason: 'max_retries' })
    broadcastStatus(service)
  })

  /**
   * Evento: tentativa de conexão em andamento.
   * Emitido no início de cada tentativa de (re)conexão. Não há dados adicionais —
   * apenas sincroniza o status ('connecting') com a UI para exibir um indicador
   * de carregamento enquanto o handshake é realizado.
   */
  client.on('connecting', () => {
    broadcastStatus(service)
  })
}
