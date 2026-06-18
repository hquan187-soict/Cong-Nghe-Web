import { useEffect } from 'react'
import { ThemeProvider } from './context/ThemeContext'
import { LangProvider, useLang } from './context/LangContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { ToastProvider } from './context/ToastContext'
import { SocketProvider } from './context/SocketContext'
import { AccessibilityProvider } from './context/AccessibilityContext'
import { NotificationProvider } from './context/NotificationContext'
import { MentionNotificationProvider } from './context/MentionNotificationContext'
import { CallProvider } from './context/CallContext'
import { setLogoutCallback } from './utils/axios'
import AppRouter from './AppRouter'
import Toast from './components/ui/Toast'
import MentionToast from './components/MentionToast'
import CallOverlay from './components/call/CallOverlay'

// Component nội bộ — kết nối hàm logout() từ AuthContext vào axios interceptor
function ConnectAxiosLogout() {
  const { logout } = useAuth()
  useEffect(() => {
    setLogoutCallback(logout)
    return () => setLogoutCallback(null)
  }, [logout])
  return null // Không render gì
}

// Wrapper để lấy ngôn ngữ từ LangContext và truyền vào GoogleOAuthProvider
function GoogleAuthWrapper({ children }) {
  const { lang } = useLang()
  return (
    <GoogleOAuthProvider key={lang} clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID} locale={lang}>
      {children}
    </GoogleOAuthProvider>
  )
}

function App() {
  return (
    <AuthProvider>
      <ConnectAxiosLogout />
      {/* SocketProvider phải nằm bên trong AuthProvider để đọc được user/token */}
      <SocketProvider>
        <CallProvider>
          <ToastProvider>
            <ThemeProvider>
              <LangProvider>
                <GoogleAuthWrapper>
                  <AccessibilityProvider>
                    <NotificationProvider>
                      <MentionNotificationProvider>
                        <AppRouter />
                        <Toast />
                        <MentionToast />
                        <CallOverlay />
                      </MentionNotificationProvider>
                    </NotificationProvider>
                  </AccessibilityProvider>
                </GoogleAuthWrapper>
              </LangProvider>
            </ThemeProvider>
          </ToastProvider>
        </CallProvider>
      </SocketProvider>
    </AuthProvider>
  )
}
export default App



