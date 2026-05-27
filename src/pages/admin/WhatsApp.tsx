import { useWhatsApp } from '@/hooks/useWhatsApp'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Smartphone, Wifi, WifiOff, RefreshCw, LogOut, Clock } from 'lucide-react'

function formatUptime(seconds: number | null): string {
  if (seconds === null) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function StatusBadge({ state }: { state: string }) {
  if (state === 'connected')
    return <Badge className="bg-green-100 text-green-800 border-green-200">Conectado</Badge>
  if (state === 'qr_ready')
    return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Aguardando QR</Badge>
  if (state === 'connecting')
    return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Conectando…</Badge>
  return <Badge className="bg-gray-100 text-gray-600 border-gray-200">Desconectado</Badge>
}

export function WhatsApp() {
  const { connected, state, qrDataUrl, uptime, loading, error, disconnect, reconnect } =
    useWhatsApp()

  // Página só faz sentido dentro do Electron
  if (!window.electronAPI?.isElectron) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <Smartphone className="w-12 h-12 text-muted-foreground" />
        <p className="text-lg font-medium text-muted-foreground">
          Disponível apenas no app desktop
        </p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Abra o PDV pelo aplicativo instalado para gerenciar a conexão do WhatsApp.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-6">

      {/* Status da conexão */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="w-5 h-5" />
            WhatsApp Business
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <StatusBadge state={state} />
          </div>

          {connected && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Conectado há
              </span>
              <span className="text-sm font-medium">{formatUptime(uptime)}</span>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            {connected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={disconnect}
                disabled={loading}
                className="w-full text-red-600 border-red-200 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Desconectar
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={reconnect}
                disabled={loading || state === 'connecting'}
                className="w-full"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {state === 'connecting' ? 'Conectando…' : 'Reconectar'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* QR Code */}
      {state === 'qr_ready' && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-yellow-900">Escaneie o QR Code</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <p className="text-sm text-yellow-800 text-center">
              Abra o WhatsApp no celular →{' '}
              <strong>Menu → Dispositivos conectados → Adicionar dispositivo</strong>
            </p>
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code WhatsApp"
                className="rounded-xl border-4 border-white shadow-md"
                width={220}
                height={220}
              />
            ) : (
              <div className="w-[220px] h-[220px] rounded-xl bg-yellow-100 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-yellow-400 animate-spin" />
              </div>
            )}
            <p className="text-xs text-yellow-700">O QR expira em ~60 segundos. Um novo será gerado automaticamente.</p>
          </CardContent>
        </Card>
      )}

      {/* Conectado */}
      {connected && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center gap-3 py-4">
            <Wifi className="w-6 h-6 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-900">WhatsApp conectado</p>
              <p className="text-xs text-green-700">
                Notificações de pedidos estão sendo enviadas automaticamente.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Desconectado sem QR */}
      {!connected && state === 'disconnected' && (
        <Card className="border-gray-200 bg-gray-50">
          <CardContent className="flex items-center gap-3 py-4">
            <WifiOff className="w-6 h-6 text-gray-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-700">WhatsApp desconectado</p>
              <p className="text-xs text-gray-500">
                Clique em <strong>Reconectar</strong> para gerar o QR Code.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  )
}
