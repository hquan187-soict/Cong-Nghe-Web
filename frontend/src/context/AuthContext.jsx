import { createContext, useContext, useState, useEffect, useCallback } from 'react'
const AuthContext = createContext()

// Key lưu trong localStorage
const STORAGE_KEY_USER  = 'auth_user'
const STORAGE_KEY_TOKEN = 'auth_token'

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null)
  const [token, setToken]         = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    try {
      const savedUser  = localStorage.getItem(STORAGE_KEY_USER)
      const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN)

      if (savedUser && savedToken) {
        const parsed = JSON.parse(savedUser)
        if (parsed && parsed._id) {
          setUser(parsed)
          setToken(savedToken)
        } else {
          localStorage.removeItem(STORAGE_KEY_USER)
          localStorage.removeItem(STORAGE_KEY_TOKEN)
        }
      }
    } catch (err) {
      console.error('AuthContext: lỗi khi restore session', err)
      localStorage.removeItem(STORAGE_KEY_USER)
      localStorage.removeItem(STORAGE_KEY_TOKEN)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // login: nhận userInfo object và token thật từ API, lưu state + localStorage 
  const login = useCallback((userInfo, receivedToken) => {
    // Nếu không truyền token (backward compat) → tạo mock
    const tokenToStore = receivedToken || 'mock-jwt-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10)

    setUser(userInfo)
    setToken(tokenToStore)

    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(userInfo))
    localStorage.setItem(STORAGE_KEY_TOKEN, tokenToStore)

    console.log('AuthContext: login thành công', { user: userInfo, token: tokenToStore })
  }, [])

  const updateUser = useCallback((newUserData) => {
    if (!newUserData || !newUserData._id) return
    setUser(newUserData)
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUserData))
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)

    localStorage.removeItem(STORAGE_KEY_USER)
    localStorage.removeItem(STORAGE_KEY_TOKEN)
    localStorage.removeItem('last_conversation')

    console.log('AuthContext: đã logout')
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth() phải được dùng bên trong <AuthProvider>')
  }
  return context
}
