import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/services/supabaseClient'
import { useUser } from '@/store/useUser'
import { Cardapio } from '@/pages/pdv/Cardapio'
import { GarcomPage } from '@/pages/garcom/GarcomPage'
import { Login } from '@/pages/auth/Login'
import { Dashboard } from '@/pages/admin/Dashboard'
import { GestaoCardapio } from '@/pages/admin/GestaoCardapio'
import { Pedidos } from '@/pages/admin/Pedidos'
import { KanbanPedidos } from '@/pages/admin/KanbanPedidos'
import { NovoPedido } from '@/pages/admin/NovoPedido'
import { Financeiro } from '@/pages/admin/Financeiro'
import { Clientes } from '@/pages/admin/Clientes'
import { WhatsApp } from '@/pages/admin/WhatsApp'
import { Impressora } from '@/pages/admin/Impressora'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { LogOut, Users, MessageCircle, Printer, Menu } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCaixaAutomatico } from '@/hooks/useCaixaAutomatico'
import { registrarAuditoria } from '@/services/audit.service'
import { AuditLog } from '@/pages/admin/AuditLog'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { value: 'dashboard',  label: 'Dashboard'   },
  { value: 'cardapio',   label: 'Cardápio'    },
  { value: 'pedidos',    label: 'Pedidos'     },
  { value: 'historico',  label: 'Histórico'   },
  { value: 'pedido',     label: 'Novo Pedido' },
  { value: 'financeiro', label: 'Financeiro'  },
  { value: 'clientes',   label: 'Clientes',   icon: Users         },
  { value: 'whatsapp',   label: 'WhatsApp',   icon: MessageCircle },
  { value: 'impressora', label: 'Impressora', icon: Printer       },
]

function AdminLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, setUser } = useUser()
  const [menuOpen, setMenuOpen] = useState(false)

  useCaixaAutomatico(user?.id)

  const tabValue = location.pathname.split('/')[2] ?? 'dashboard'

  function navTo(v: string) {
    navigate(`/admin/${v === 'dashboard' ? '' : v}`)
    setMenuOpen(false)
  }

  async function handleLogout() {
    await registrarAuditoria('logout', { email: user?.email })
    await supabase.auth.signOut()
    setUser(null)
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between py-2 gap-2">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="md:hidden"
                aria-label="Abrir menu"
                onClick={() => setMenuOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>
              <span className="font-bold text-primary shrink-0">Luizão Admin</span>
            </div>
            <Button size="sm" variant="ghost" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
          <Tabs
            value={tabValue}
            onValueChange={(v) => navigate(`/admin/${v === 'dashboard' ? '' : v}`)}
          >
            <TabsList className="admin-nav-tabs w-full hidden md:grid grid-cols-9 mb-2">
              <TabsTrigger value="dashboard" className="text-xs sm:text-sm">Dashboard</TabsTrigger>
              <TabsTrigger value="cardapio" className="text-xs sm:text-sm">Cardápio</TabsTrigger>
              <TabsTrigger value="pedidos" className="text-xs sm:text-sm">Pedidos</TabsTrigger>
              <TabsTrigger value="historico" className="text-xs sm:text-sm">Histórico</TabsTrigger>
              <TabsTrigger value="pedido" className="text-xs sm:text-sm">Novo Pedido</TabsTrigger>
              <TabsTrigger value="financeiro" className="text-xs sm:text-sm">Financeiro</TabsTrigger>
              <TabsTrigger value="clientes" className="text-xs sm:text-sm flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                Clientes
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="text-xs sm:text-sm flex items-center gap-1">
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </TabsTrigger>
              <TabsTrigger value="impressora" className="text-xs sm:text-sm flex items-center gap-1">
                <Printer className="h-3.5 w-3.5" />
                Impressora
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6 min-h-[calc(100vh-84px)]">
        <div key={location.pathname} className="admin-route-transition">
          {children}
        </div>
      </main>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent>
          <SheetTitle className="px-4 pt-5 pb-3 text-primary">
            Luizão Admin
          </SheetTitle>
          <nav className="flex flex-col gap-1 px-2">
            {NAV_ITEMS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => navTo(value)}
                className={cn(
                  'flex items-center gap-3 w-full px-3 py-2.5 text-sm text-left rounded-md transition-colors',
                  tabValue === value
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'hover:bg-muted text-foreground'
                )}
              >
                {Icon
                  ? <Icon className="h-4 w-4 shrink-0" />
                  : <span className="h-4 w-4 shrink-0" aria-hidden="true" />}
                {label}
              </button>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useUser()
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export function AppRoutes() {
  const { user, setUser } = useUser()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setChecking(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      // Ignora SIGNED_OUT causado por falha de rede (troca de WiFi, queda momentânea)
      if (event === 'SIGNED_OUT' && !navigator.onLine) return
      setUser(session?.user ?? null)
      if (event === 'SIGNED_IN' && session?.user) {
        registrarAuditoria('login', { email: session.user.email })
      }
    })

    // Quando a internet voltar, tenta restaurar a sessão que pode ter sido perdida
    function handleOnline() {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) setUser(data.session.user)
      })
    }
    window.addEventListener('online', handleOnline)

    return () => {
      listener.subscription.unsubscribe()
      window.removeEventListener('online', handleOnline)
    }
  }, [setUser])

  if (checking) return null

  return (
    <Routes>
      <Route path="/" element={<Cardapio />} />
      <Route path="/login" element={user ? <Navigate to="/admin" replace /> : <Login />} />

      <Route path="/admin" element={
        <ProtectedRoute><AdminLayout><Dashboard /></AdminLayout></ProtectedRoute>
      } />
      <Route path="/admin/cardapio" element={
        <ProtectedRoute><AdminLayout><GestaoCardapio /></AdminLayout></ProtectedRoute>
      } />
      <Route path="/admin/pedidos" element={
        <ProtectedRoute><AdminLayout><KanbanPedidos /></AdminLayout></ProtectedRoute>
      } />
      <Route path="/admin/historico" element={
        <ProtectedRoute><AdminLayout><Pedidos /></AdminLayout></ProtectedRoute>
      } />
      <Route path="/admin/financeiro" element={
        <ProtectedRoute><AdminLayout><Financeiro /></AdminLayout></ProtectedRoute>
      } />
      <Route path="/admin/clientes" element={
        <ProtectedRoute><AdminLayout><Clientes /></AdminLayout></ProtectedRoute>
      } />
      <Route path="/admin/whatsapp" element={
        <ProtectedRoute><AdminLayout><WhatsApp /></AdminLayout></ProtectedRoute>
      } />
      <Route path="/admin/impressora" element={
        <ProtectedRoute><AdminLayout><Impressora /></AdminLayout></ProtectedRoute>
      } />
      <Route path="/admin/auditoria" element={
        <ProtectedRoute><AdminLayout><AuditLog /></AdminLayout></ProtectedRoute>
      } />

      <Route path="/admin/pedido" element={
        <ProtectedRoute><AdminLayout><NovoPedido /></AdminLayout></ProtectedRoute>
      } />

      <Route path="/garcom" element={<ProtectedRoute><GarcomPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
