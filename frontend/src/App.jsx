import { useEffect } from 'react'
import { ThemeProvider } from './context/ThemeContext'
import { LangProvider } from './context/LangContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { SocketProvider } from './context/SocketContext'
import { AccessibilityProvider } from './context/AccessibilityContext'
import { NotificationProvider } from './context/NotificationContext'
import { MentionNotificationProvider } from './context/MentionNotificationContext'
import { setLogoutCallback } from './utils/axios'
import AppRouter from './AppRouter'
import Toast from './components/ui/Toast'
import MentionToast from './components/MentionToast'

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
              <AccessibilityProvider>
                <NotificationProvider>
                  <MentionNotificationProvider>
                    <AppRouter />
                    <Toast />
                    <MentionToast />
                  </MentionNotificationProvider>
                </NotificationProvider>
              </AccessibilityProvider>
            </LangProvider>
          </ThemeProvider>
        </ToastProvider>
      </SocketProvider>
    </AuthProvider>
  )
}
export default App



