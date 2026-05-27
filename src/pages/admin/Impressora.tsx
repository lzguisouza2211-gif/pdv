import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Printer, RefreshCw, Check } from 'lucide-react'

interface PrinterInfo {
  name: string
  isDefault: boolean
}

interface PrinterConfig {
  printerName: string
  printerPath: string
}

export function Impressora() {
  if (!window.electronAPI?.isElectron) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <Printer className="w-12 h-12 text-muted-foreground" />
        <p className="text-lg font-medium text-muted-foreground">
          Disponível apenas no app desktop
        </p>
      </div>
    )
  }

  const [config, setConfig] = useState<PrinterConfig>({ printerName: '', printerPath: '' })
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    Promise.all([
      window.electronAPI!.printer.getConfig(),
      window.electronAPI!.printer.listPrinters(),
    ]).then(([cfg, list]) => {
      setConfig(cfg)
      setPrinters(list)
      setLoading(false)
    })
  }, [])

  async function save() {
    setSaving(true)
    await window.electronAPI!.printer.setConfig(config)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Printer className="w-5 h-5" />
            Configuração da Impressora
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">

          {/* Lista de impressoras detectadas */}
          {printers.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Impressoras detectadas no sistema</Label>
              <div className="flex flex-col gap-1 max-h-52 overflow-y-auto rounded-md border p-1">
                {printers.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => setConfig((c) => ({ ...c, printerName: p.name }))}
                    className={`flex items-center justify-between px-3 py-2 rounded text-sm text-left hover:bg-muted transition-colors ${
                      config.printerName === p.name
                        ? 'bg-primary/10 font-medium text-primary'
                        : ''
                    }`}
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="flex items-center gap-2 shrink-0 ml-2">
                      {p.isDefault && (
                        <span className="text-xs text-muted-foreground">padrão</span>
                      )}
                      {config.printerName === p.name && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Clique numa impressora para selecioná-la.
              </p>
            </div>
          )}

          {/* Nome manual */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="printerName" className="text-sm font-medium">
              Nome da impressora
            </Label>
            <Input
              id="printerName"
              value={config.printerName}
              onChange={(e) => setConfig((c) => ({ ...c, printerName: e.target.value }))}
              placeholder="ex: Printer POS-80"
            />
            <p className="text-xs text-muted-foreground">
              Nome exato como aparece em <strong>Painel de Controle → Dispositivos e Impressoras</strong>.
              Deixe vazio para usar a impressora padrão do sistema.
            </p>
          </div>

          <Button onClick={save} disabled={saving} className="w-full">
            {saved ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Salvo com sucesso!
              </>
            ) : saving ? (
              'Salvando…'
            ) : (
              'Salvar configurações'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Dica */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="py-4 text-sm text-blue-800">
          <strong>Dica:</strong> para descobrir o nome exato da impressora no Windows, abra o
          Prompt de Comando e digite <code className="bg-blue-100 px-1 rounded">wmic printer get name</code>.
        </CardContent>
      </Card>
    </div>
  )
}
