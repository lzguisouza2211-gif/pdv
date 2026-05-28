import { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { NovoPedido } from '@/pages/admin/NovoPedido'
import { ChevronLeft, Settings, X } from 'lucide-react'
import { supabase } from '@/services/supabaseClient'

interface MesaConfig {
  numMesas: number
  temBalcao: boolean
  temViagem: boolean
}

const DEFAULT_CONFIG: MesaConfig = { numMesas: 10, temBalcao: true, temViagem: true }

function loadConfig(): MesaConfig {
  try {
    const s = localStorage.getItem('garcom_mesa_config')
    if (s) return { ...DEFAULT_CONFIG, ...JSON.parse(s) }
  } catch {}
  return DEFAULT_CONFIG
}

function buildMesas(config: MesaConfig): string[] {
  const mesas = Array.from({ length: config.numMesas }, (_, i) => `Mesa ${i + 1}`)
  if (config.temBalcao) mesas.push('Balcão')
  if (config.temViagem) mesas.push('Viagem')
  return mesas
}

export function GarcomPage() {
  const [mesa, setMesa] = useState<string | null>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const isAdmin = location.pathname.startsWith('/admin')
  const [config, setConfig] = useState<MesaConfig>(loadConfig)
  const [showSettings, setShowSettings] = useState(false)
  const [draftConfig, setDraftConfig] = useState<MesaConfig>(loadConfig)
  const [mesasOcupadas, setMesasOcupadas] = useState<Set<string>>(new Set())

  const fetchOcupadas = useCallback(async () => {
    const hoje = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    const [d, m, y] = hoje.split('/')
    const startUTC = new Date(`${y}-${m}-${d}T00:00:00-03:00`).toISOString()
    const endUTC = new Date(`${y}-${m}-${d}T23:59:59-03:00`).toISOString()

    const { data } = await supabase
      .from('pedidos')
      .select('cliente')
      .in('status', ['Recebido', 'Em preparo'])
      .neq('cliente', 'Viagem')
      .gte('created_at', startUTC)
      .lte('created_at', endUTC)

    if (data) {
      setMesasOcupadas(new Set(data.map((p) => p.cliente).filter(Boolean)))
    }
  }, [])

  useEffect(() => {
    fetchOcupadas()

    const channel = supabase
      .channel('garcom-pedidos-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        fetchOcupadas()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchOcupadas])

  const mesas = buildMesas(config)

  function handleSelectMesa(m: string) {
    setMesa(m)
  }

  function handleBack() {
    setMesa(null)
    fetchOcupadas()
  }

  function handleSuccess() {
    setMesa(null)
    fetchOcupadas()
  }

  function handleSaveConfig() {
    setConfig(draftConfig)
    localStorage.setItem('garcom_mesa_config', JSON.stringify(draftConfig))
    setShowSettings(false)
  }

  if (mesa) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="bg-primary text-primary-foreground px-4 pt-safe pb-3 sticky top-0 z-30">
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleBack}
              className="p-1.5 rounded-full hover:bg-primary-foreground/20 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 text-center">
              <p className="font-bold text-lg leading-tight">{mesa}</p>
              <p className="text-primary-foreground/70 text-xs">Luizão Lanches</p>
            </div>
            <div className="w-8" />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <NovoPedido defaultCliente={mesa} lockTipoEntrega="local" onSuccess={handleSuccess} />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground px-4 pt-safe pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between pt-2">
          {isAdmin ? (
            <button
              onClick={() => navigate('/admin')}
              className="p-1.5 rounded-full hover:bg-primary-foreground/20 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <div className="w-8" />
          )}
          <div className="text-center">
            <h1 className="text-xl font-bold">🍔 Luizão Lanches</h1>
            <p className="text-primary-foreground/70 text-sm mt-0.5">Selecione a mesa</p>
          </div>
          <button
            onClick={() => { setDraftConfig(config); setShowSettings(true) }}
            className="p-1.5 rounded-full hover:bg-primary-foreground/20 transition-colors"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4">
        <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
          {mesas.map((m) => {
            const isOcupada = mesasOcupadas.has(m)
            return (
              <button
                key={m}
                onClick={() => handleSelectMesa(m)}
                className={`aspect-square flex flex-col items-center justify-center rounded-2xl border-2 transition-all shadow-sm active:scale-95 ${
                  isOcupada
                    ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30'
                    : 'border-border bg-card hover:border-primary hover:bg-primary/5'
                }`}
              >
                <span className="text-2xl mb-1">
                  {m === 'Viagem' ? '🛍️' : isOcupada ? '🔴' : '🪑'}
                </span>
                <span className={`text-sm font-semibold text-center leading-tight px-1 ${isOcupada ? 'text-orange-700 dark:text-orange-300' : ''}`}>
                  {m}
                </span>
                {isOcupada && (
                  <span className="text-xs text-orange-500 dark:text-orange-400 font-medium mt-0.5">Em uso</span>
                )}
              </button>
            )
          })}
        </div>
      </main>

      {showSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-background w-full rounded-t-2xl p-6 pb-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">Configurar Mesas</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 rounded-full hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3">Número de mesas numeradas</p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setDraftConfig((c) => ({ ...c, numMesas: Math.max(1, c.numMesas - 1) }))}
                    className="w-11 h-11 rounded-full border-2 border-border text-xl font-bold flex items-center justify-center hover:bg-muted active:scale-95 transition-all"
                  >
                    −
                  </button>
                  <span className="text-3xl font-bold w-14 text-center">{draftConfig.numMesas}</span>
                  <button
                    onClick={() => setDraftConfig((c) => ({ ...c, numMesas: Math.min(30, c.numMesas + 1) }))}
                    className="w-11 h-11 rounded-full border-2 border-border text-xl font-bold flex items-center justify-center hover:bg-muted active:scale-95 transition-all"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3">Opções adicionais</p>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draftConfig.temBalcao}
                      onChange={(e) => setDraftConfig((c) => ({ ...c, temBalcao: e.target.checked }))}
                      className="w-5 h-5 rounded accent-primary"
                    />
                    <span className="font-medium text-base">🪑 Balcão</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draftConfig.temViagem}
                      onChange={(e) => setDraftConfig((c) => ({ ...c, temViagem: e.target.checked }))}
                      className="w-5 h-5 rounded accent-primary"
                    />
                    <span className="font-medium text-base">🛍️ Viagem</span>
                  </label>
                </div>
              </div>
            </div>

            <button
              onClick={handleSaveConfig}
              className="w-full mt-8 bg-primary text-primary-foreground py-3.5 rounded-xl font-semibold text-base active:scale-[0.98] transition-all"
            >
              Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
