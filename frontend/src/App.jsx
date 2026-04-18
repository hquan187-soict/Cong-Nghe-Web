import { useEffect } from 'react'
import { ThemeProvider } from './context/ThemeContext'
import { LangProvider } from './context/LangContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { setLogoutCallback } from './utils/axios'
import AppRouter from './AppRouter'
import Demo from "./components/ui/Demo";
import AppLayout from "./components/layout/AppLayout";
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
      <ThemeProvider>
        <LangProvider>
          <AppRouter />
          <Demo /> 
        </LangProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}
export default App

