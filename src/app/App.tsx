import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from './AppRoutes'
import { Toaster } from '@/components/ui/toaster'

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
      <Toaster />
    </BrowserRouter>
  )
}
