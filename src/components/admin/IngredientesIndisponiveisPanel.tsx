import { useEffect, useState } from 'react'
import { IngredienteIndisponivel } from '@/types'
import { fetchIngredientesIndisponiveis, toggleIngrediente } from '@/services/api/ingredientes.service'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

export function IngredientesIndisponiveisPanel() {
  const [ingredientes, setIngredientes] = useState<IngredienteIndisponivel[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    fetchIngredientesIndisponiveis()
      .then(setIngredientes)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleToggle(ingrediente: string, current: boolean) {
    setToggling(ingrediente)
    try {
      await toggleIngrediente(ingrediente, !current)
      setIngredientes((prev) =>
        prev.map((i) => (i.ingrediente === ingrediente ? { ...i, indisponivel: !current } : i))
      )
    } catch {
    } finally {
      setToggling(null)
    }
  }

  const indisponiveis = ingredientes.filter((i) => i.indisponivel)
  const disponiveis = ingredientes.filter((i) => !i.indisponivel)

  if (loading) {
    return (
      <div className="flex flex-wrap gap-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-9 w-24 rounded-full bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Clique num ingrediente para marcar como indisponível — ele será bloqueado no cardápio do cliente.
      </p>

      {indisponiveis.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-sm font-semibold text-red-600">
              Indisponíveis agora ({indisponiveis.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {indisponiveis.map((ing) => (
              <button
                key={ing.ingrediente}
                disabled={toggling === ing.ingrediente}
                onClick={() => handleToggle(ing.ingrediente, ing.indisponivel)}
                className="px-3 py-1.5 rounded-full text-sm font-medium border transition-all
                  bg-red-100 text-red-700 border-red-300
                  hover:bg-red-200 active:scale-95
                  dark:bg-red-950 dark:text-red-400 dark:border-red-800
                  disabled:opacity-50 disabled:cursor-not-allowed capitalize"
              >
                ✕ {ing.ingrediente}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="text-sm font-semibold text-green-700">
            Disponíveis ({disponiveis.length})
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {disponiveis.map((ing) => (
            <button
              key={ing.ingrediente}
              disabled={toggling === ing.ingrediente}
              onClick={() => handleToggle(ing.ingrediente, ing.indisponivel)}
              className="px-3 py-1.5 rounded-full text-sm font-medium border transition-all
                bg-muted/50 text-muted-foreground border-border
                hover:bg-muted hover:text-foreground active:scale-95
                disabled:opacity-50 disabled:cursor-not-allowed capitalize"
            >
              {ing.ingrediente}
            </button>
          ))}
        </div>
      </div>

      {ingredientes.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhum ingrediente cadastrado.
        </p>
      )}
    </div>
  )
}
