import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import { EnterpriseProvider } from '@/contexts/EnterpriseContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
    },
  },
})

const basename = import.meta.env.VITE_BASE_PATH?.replace(/\/$/, '') || ''

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <EnterpriseProvider>
            <BrowserRouter basename={basename}>
              <App />
              <Toaster position="top-right" richColors closeButton />
            </BrowserRouter>
          </EnterpriseProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
)
