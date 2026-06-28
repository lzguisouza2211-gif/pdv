import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/services/supabaseClient'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent } from '@/components/ui/card'
import { Shield } from 'lucide-react'

type AuditEntry = {
  id: string
  user_email: string | null
  acao: string
  tabela: string | null
  registro_id: string | null
  detalhes: Record<string, unknown> | null
  created_at: string
}

const ACAO_META: Record<string, { label: string; color: string }> = {
  login:                     { label: 'Login',               color: 'bg-green-100 text-green-800' },
  logout:                    { label: 'Logout',              color: 'bg-gray-100 text-gray-700' },
  status_pedido_alterado:    { label: 'Status alterado',     color: 'bg-blue-100 text-blue-800' },
  total_pedido_alterado:     { label: 'Total alterado',      color: 'bg-orange-100 text-orange-800' },
  pedido_editado:            { label: 'Pedido editado',      color: 'bg-yellow-100 text-yellow-800' },
  pedido_excluido:           { label: 'Pedido excluído',     color: 'bg-red-100 text-red-800' },
  preco_alterado:            { label: 'Preço alterado',      color: 'bg-purple-100 text-purple-800' },
  produto_disponibilizado:   { label: 'Disponibilizado',     color: 'bg-teal-100 text-teal-800' },
  produto_indisponibilizado: { label: 'Indisponibilizado',   color: 'bg-rose-100 text-rose-800' },
  produto_ativado:           { label: 'Ativado',             color: 'bg-green-100 text-green-800' },
  produto_desativado:        { label: 'Desativado',          color: 'bg-red-100 text-red-800' },
  produto_renomeado:         { label: 'Renomeado',           color: 'bg-indigo-100 text-indigo-800' },
  produto_editado:           { label: 'Produto editado',     color: 'bg-yellow-100 text-yellow-800' },
  produto_excluido:          { label: 'Produto excluído',    color: 'bg-red-100 text-red-800' },
}

function humanize(detalhes: Record<string, unknown> | null): string {
  if (!detalhes) return '—'
  const parts: string[] = []
  if (detalhes.email)          parts.push(String(detalhes.email))
  if (detalhes.cliente)        parts.push(`Cliente: ${detalhes.cliente}`)
  if (detalhes.produto)        parts.push(`Produto: ${detalhes.produto}`)
  if (detalhes.status_anterior !== undefined && detalhes.status_novo !== undefined)
    parts.push(`${detalhes.status_anterior} → ${detalhes.status_novo}`)
  if (detalhes.preco_anterior !== undefined && detalhes.preco_novo !== undefined)
    parts.push(`R$ ${Number(detalhes.preco_anterior).toFixed(2)} → R$ ${Number(detalhes.preco_novo).toFixed(2)}`)
  if (detalhes.total_anterior !== undefined && detalhes.total_novo !== undefined)
    parts.push(`R$ ${Number(detalhes.total_anterior).toFixed(2)} → R$ ${Number(detalhes.total_novo).toFixed(2)}`)
  if (detalhes.nome_anterior !== undefined && detalhes.nome_novo !== undefined)
    parts.push(`${detalhes.nome_anterior} → ${detalhes.nome_novo}`)
  if (detalhes.categoria)      parts.push(`Cat: ${detalhes.categoria}`)
  if (detalhes.status && !detalhes.status_anterior) parts.push(`Status: ${detalhes.status}`)
  if (detalhes.total && !detalhes.total_anterior)   parts.push(`Total: R$ ${Number(detalhes.total).toFixed(2)}`)
  return parts.join(' · ') || JSON.stringify(detalhes)
}

export function AuditLog() {
  const [entries, setEntries]     = useState<AuditEntry[]>([])
  const [loading, setLoading]     = useState(true)
  const [filterAcao, setFilter]   = useState('todas')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300)
    setEntries(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = filterAcao === 'todas'
    ? entries
    : entries.filter(e => e.acao === filterAcao)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Log de Auditoria
        </h2>
        <select
          value={filterAcao}
          onChange={e => setFilter(e.target.value)}
          className="text-sm border rounded px-2 py-1 bg-background"
        >
          <option value="todas">Todas as ações</option>
          {Object.entries(ACAO_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-10 text-center text-muted-foreground text-sm">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">Nenhum registro encontrado.</div>
          ) : (
            <>
              {/* desktop */}
              <div className="overflow-x-auto hidden md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-muted-foreground">
                      <th className="text-left px-4 py-2 font-medium whitespace-nowrap">Data/hora</th>
                      <th className="text-left px-4 py-2 font-medium">Ação</th>
                      <th className="text-left px-4 py-2 font-medium">Usuário</th>
                      <th className="text-left px-4 py-2 font-medium">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(entry => {
                      const meta = ACAO_META[entry.acao]
                      return (
                        <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                            {format(new Date(entry.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${meta?.color ?? 'bg-gray-100 text-gray-700'}`}>
                              {meta?.label ?? entry.acao}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {entry.user_email ?? '—'}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {humanize(entry.detalhes)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* mobile */}
              <div className="md:hidden space-y-2 p-3">
                {filtered.map(entry => {
                  const meta = ACAO_META[entry.acao]
                  return (
                    <div key={entry.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${meta?.color ?? 'bg-gray-100 text-gray-700'}`}>
                          {meta?.label ?? entry.acao}
                        </span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(entry.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-sm mt-1.5">{entry.user_email ?? '—'}</p>
                      <p className="text-sm text-muted-foreground mt-1 break-words">{humanize(entry.detalhes)}</p>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
