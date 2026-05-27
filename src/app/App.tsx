import { BrowserRouter, HashRouter } from 'react-router-dom'
import { AppRoutes } from './AppRoutes'
import { Toaster } from '@/components/ui/toaster'

// No Electron usa HashRouter: funciona com file:// na build de produção.
// Na web (Vercel) usa BrowserRouter: URLs limpas (/admin, /login, etc).
const Router = window.electronAPI?.isElectron ? HashRouter : BrowserRouter

export function App() {
  return (
    <Router>
      <AppRoutes />
      <Toaster />
    </Router>
  )
}
