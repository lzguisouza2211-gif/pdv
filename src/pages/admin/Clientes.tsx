import { useState, useEffect, useCallback } from 'react'
import { Cliente } from '@/types'
import { listarClientes } from '@/services/api/clientes.service'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/utils/calc'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Search, Users } from 'lucide-react'

const PER_PAGE = 20

export function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listarClientes({ page, perPage: PER_PAGE, search: search || undefined })
      setClientes(result.data)
      setCount(result.count)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    load()
  }, [load])

  function handleSearch() {
    setPage(1)
    setSearch(searchInput)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSearch()
  }

  const totalPages = Math.ceil(count / PER_PAGE)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-8"
          />
        </div>
        <Button variant="outline" onClick={handleSearch}>
          Buscar
        </Button>
      </div>

      {loading && <p className="text-muted-foreground">Carregando…</p>}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left font-medium px-4 py-3 text-muted-foreground">Nome</th>
                <th className="text-left font-medium px-4 py-3 text-muted-foreground">Telefone</th>
                <th className="text-center font-medium px-4 py-3 text-muted-foreground">Pedidos</th>
                <th className="text-right font-medium px-4 py-3 text-muted-foreground">Total Gasto</th>
                <th className="text-right font-medium px-4 py-3 text-muted-foreground">Último Pedido</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{c.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.phone}</td>
                  <td className="px-4 py-3 text-center">{c.total_pedidos}</td>
                  <td className="px-4 py-3 text-right text-primary font-medium">{formatBRL(c.total_gasto)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {c.ultima_compra
                      ? formatDistanceToNow(new Date(c.ultima_compra), { addSuffix: true, locale: ptBR })
                      : '—'}
                  </td>
                </tr>
              ))}
              {!loading && clientes.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Users className="h-8 w-8" />
                      <p>
                        {search
                          ? 'Nenhum cliente encontrado para esta busca.'
                          : 'Nenhum cliente cadastrado ainda.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {count} cliente{count !== 1 ? 's' : ''} — página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
