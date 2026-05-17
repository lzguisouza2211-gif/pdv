import { useEffect, useState } from 'react'
import { IngredienteIndisponivel } from '@/types'
import { fetchIngredientesIndisponiveis, toggleIngrediente } from '@/services/api/ingredientes.service'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

export function IngredientesIndisponiveisPanel() {
  const [ingredientes, setIngredientes] = useState<IngredienteIndisponivel[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const data = await fetchIngredientesIndisponiveis()
      setIngredientes(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleToggle(ingrediente: string, current: boolean) {
    try {
      await toggleIngrediente(ingrediente, !current)
      setIngredientes((prev) =>
        prev.map((i) =>
          i.ingrediente === ingrediente ? { ...i, indisponivel: !current } : i
        )
      )
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) return <p className="text-muted-foreground text-sm">Carregando…</p>

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {ingredientes.map((ing) => (
        <div key={ing.ingrediente} className="flex items-center justify-between border rounded-md p-3">
          <Label className="capitalize text-sm cursor-pointer">{ing.ingrediente}</Label>
          <Switch
            checked={ing.indisponivel}
            onCheckedChange={() => handleToggle(ing.ingrediente, ing.indisponivel)}
          />
        </div>
      ))}
    </div>
  )
}
