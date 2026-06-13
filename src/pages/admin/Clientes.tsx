import { useState, useEffect, useCallback, useRef } from 'react'
import { Cliente } from '@/types'
import { listarClientes } from '@/services/api/clientes.service'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatBRL } from '@/utils/calc'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Search, Users, Phone, ShoppingBag, MapPin, Clock, X, ChevronLeft, ChevronRight } from 'lucide-react'

const PER_PAGE = 18

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-green-600', 'bg-amber-500',
  'bg-red-500', 'bg-pink-500', 'bg-cyan-600', 'bg-orange-500',
]

function avatarColor(nome: string): string {
  return AVATAR_COLORS[nome.charCodeAt(0) % AVATAR_COLORS.length]
}

function frequenciaBadge(pedidos: number): { label: string; className: string } {
  if (pedidos >= 15) return { label: '⭐ VIP', className: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300' }
  if (pedidos >= 6)  return { label: 'Fiel', className: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-300' }
  if (pedidos >= 2)  return { label: 'Regular', className: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300' }
  return { label: 'Novo', className: 'bg-muted text-muted-foreground border-border' }
}

function ClienteCard({ c }: { c: Cliente }) {
  const initials = c.nome.trim().split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  const badge = frequenciaBadge(c.total_pedidos)
  const temEndereco = c.tipoentrega === 'entrega' && c.endereco

  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
      {/* Header: avatar + nome + badge */}
      <div className="flex items-start gap-3">
        <div className={`${avatarColor(c.nome)} text-white font-bold text-sm rounded-full h-10 w-10 flex items-center justify-center shrink-0`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-sm leading-tight truncate">{c.nome}</p>
            <Badge variant="outline" className={`text-xs shrink-0 ${badge.className}`}>
              {badge.label}
            </Badge>
          </div>
          <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
            <Phone className="h-3 w-3 shrink-0" />
            <span>{c.phone}</span>
          </div>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
            <ShoppingBag className="h-3 w-3" /> Pedidos
          </div>
          <p className="text-sm font-bold">{c.total_pedidos}</p>
        </div>
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
            <span className="text-xs">R$</span> Total gasto
          </div>
          <p className="text-sm font-bold text-primary">{formatBRL(c.total_gasto)}</p>
        </div>
      </div>

      {/* Rodapé: última compra + endereço */}
      <div className="space-y-1">
        {c.ultima_compra && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            <span>
              Último pedido{' '}
              {formatDistanceToNow(new Date(c.ultima_compra), { addSuffix: true, locale: ptBR })}
            </span>
          </div>
        )}
        {temEndereco && (
          <div className="flex items-start gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
            <span className="truncate">
              {c.endereco}{c.numero ? `, ${c.numero}` : ''}{c.bairro ? ` — ${c.bairro}` : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 bg-muted rounded" />
          <div className="h-3 w-1/2 bg-muted rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="h-12 bg-muted rounded-lg" />
        <div className="h-12 bg-muted rounded-lg" />
      </div>
      <div className="h-3 w-2/3 bg-muted rounded" />
    </div>
  )
}

export function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (q: string, p: number) => {
    setLoading(true)
    try {
      const result = await listarClientes({ page: p, perPage: PER_PAGE, search: q || undefined })
      setClientes(result.data)
      setCount(result.count)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce search — dispara 400ms após parar de digitar
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      load(search, 1)
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search, load])

  // Paginação sem debounce
  useEffect(() => {
    load(search, page)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const totalPages = Math.ceil(count / PER_PAGE)
  const ticketMedioGeral = clientes.length > 0
    ? clientes.reduce((s, c) => s + (c.total_pedidos > 0 ? c.total_gasto / c.total_pedidos : 0), 0) / clientes.length
    : 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5" /> Clientes
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {count > 0 ? `${count} cliente${count !== 1 ? 's' : ''} cadastrado${count !== 1 ? 's' : ''}` : 'Carregando…'}
          </p>
        </div>

        {/* Ticket médio visível da página atual */}
        {!loading && clientes.length > 0 && (
          <div className="text-right text-sm">
            <p className="text-xs text-muted-foreground">Ticket médio (página)</p>
            <p className="font-bold text-primary">{formatBRL(ticketMedioGeral)}</p>
          </div>
        )}
      </div>

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar por nome ou telefone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-8"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Grid de cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : clientes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <Users className="h-12 w-12 opacity-30" />
          <p className="text-sm">
            {search ? 'Nenhum cliente encontrado para esta busca.' : 'Nenhum cliente cadastrado ainda.'}
          </p>
          {search && (
            <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
              Limpar busca
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {clientes.map((c) => <ClienteCard key={c.id} c={c} />)}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground pt-1">
          <span>
            Página {page} de {totalPages} · {count} cliente{count !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
