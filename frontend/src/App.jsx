import { useEffect } from 'react'
import { ThemeProvider } from './context/ThemeContext'
import { LangProvider } from './context/LangContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { SocketProvider } from './context/SocketContext'
import { setLogoutCallback } from './utils/axios'
import AppRouter from './AppRouter'
import Toast from './components/ui/Toast'

// Component nội bộ — kết nối hàm logout() từ AuthContext vào axios interceptor
function ConnectAxiosLogout() {
  const { logout } = useAuth()
  useEffect(() => {
    setLogoutCallback(logout)
    return () => setLogoutCallback(null)
  }, [logout])
  return null // Không render gì
}

function App() {
  return (
    <AuthProvider>
      <ConnectAxiosLogout />
      {/* SocketProvider phải nằm bên trong AuthProvider để đọc được user/token */}
      <SocketProvider>
        <ToastProvider>
          <ThemeProvider>
            <LangProvider>
              <AppRouter />
              <Toast />
            </LangProvider>
          </ThemeProvider>
        </ToastProvider>
      </SocketProvider>
    </AuthProvider>
  )
}
export default App



