import { createContext, useContext, useState, useCallback } from 'react'
const ToastContext = createContext()

let toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  // Xoá một toast theo id
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.map(t =>
      t.id === id ? { ...t, removing: true } : t
    ))
    // Đợi animation slide-out xong (300ms) rồi mới xoá khỏi DOM
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 300)
  }, [])

  // Thêm toast mới — tự dismiss sau 3s
  const showToast = useCallback((message, type = 'info') => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message, type, removing: false }])

    // Tự động dismiss sau 3 giây
    setTimeout(() => {
      removeToast(id)
    }, 3000)

    return id
  }, [removeToast])

  // Shorthand helpers
  const success = useCallback((msg) => showToast(msg, 'success'), [showToast])
  const error = useCallback((msg) => showToast(msg, 'error'), [showToast])
  const info = useCallback((msg) => showToast(msg, 'info'), [showToast])

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast, success, error, info }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast() phải được dùng bên trong <ToastProvider>')
  }
  return context
}
