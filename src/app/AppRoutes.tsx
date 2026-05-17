import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/services/supabaseClient'
import { useUser } from '@/store/useUser'
import { Cardapio } from '@/pages/pdv/Cardapio'
import { Login } from '@/pages/auth/Login'
import { Dashboard } from '@/pages/admin/Dashboard'
import { GestaoCardapio } from '@/pages/admin/GestaoCardapio'
import { Pedidos } from '@/pages/admin/Pedidos'
import { Financeiro } from '@/pages/admin/Financeiro'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function AdminLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { setUser } = useUser()

  const tabValue = location.pathname.split('/')[2] ?? 'dashboard'

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <span className="font-bold text-primary">Luizão Admin</span>
          <Tabs
            value={tabValue}
            onValueChange={(v) => navigate(`/admin/${v === 'dashboard' ? '' : v}`)}
          >
            <TabsList>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="cardapio">Cardápio</TabsTrigger>
              <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
              <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button size="sm" variant="ghost" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
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

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => listener.subscription.unsubscribe()
  }, [setUser])

  if (checking) return null

  return (
    <Routes>
      <Route path="/" element={<Cardapio />} />
      <Route path="/login" element={user ? <Navigate to="/admin" replace /> : <Login />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout>
              <Dashboard />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/cardapio"
        element={
          <ProtectedRoute>
            <AdminLayout>
              <GestaoCardapio />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/pedidos"
        element={
          <ProtectedRoute>
            <AdminLayout>
              <Pedidos />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/financeiro"
        element={
          <ProtectedRoute>
            <AdminLayout>
              <Financeiro />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
