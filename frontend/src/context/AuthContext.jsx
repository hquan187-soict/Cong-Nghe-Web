import { createContext, useContext, useState, useEffect, useCallback } from 'react'
// AuthContext — quản lý trạng thái xác thực trong toàn bộ app
// state: { user, token, isLoading }
// actions: login(), logout()
// Tự động restore session từ localStorage khi app khởi động
const AuthContext = createContext()

// Key lưu trong localStorage
const STORAGE_KEY_USER  = 'auth_user'
const STORAGE_KEY_TOKEN = 'auth_token'

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null)
  const [token, setToken]         = useState(null)
  const [isLoading, setIsLoading] = useState(true) // true cho đến khi restore xong

  // useEffect: restore session từ localStorage khi mount 
  useEffect(() => {
    try {
      const savedUser  = localStorage.getItem(STORAGE_KEY_USER)
      const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN)

      if (savedUser && savedToken) {
        setUser(JSON.parse(savedUser))
        setToken(savedToken)
      }
    } catch (err) {
      // Nếu dữ liệu bị hỏng → xoá sạch
      console.error('AuthContext: lỗi khi restore session', err)
      localStorage.removeItem(STORAGE_KEY_USER)
      localStorage.removeItem(STORAGE_KEY_TOKEN)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // login: nhận userInfo object, tạo mock token, lưu state + localStorage 
  const login = useCallback((userInfo) => {
    // Tạo mock token (giả lập JWT)
    const mockToken = 'mock-jwt-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10)

    setUser(userInfo)
    setToken(mockToken)

    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(userInfo))
    localStorage.setItem(STORAGE_KEY_TOKEN, mockToken)

    console.log('AuthContext: login thành công', { user: userInfo, token: mockToken })
  }, [])

  //  logout: xoá state + localStorage 
  const logout = useCallback(() => {
    setUser(null)
    setToken(null)

    localStorage.removeItem(STORAGE_KEY_USER)
    localStorage.removeItem(STORAGE_KEY_TOKEN)

    console.log('AuthContext: đã logout')
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook tiện ích — dùng trong component: const { user, token, login, logout } = useAuth()
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth() phải được dùng bên trong <AuthProvider>')
  }
  return context
}
