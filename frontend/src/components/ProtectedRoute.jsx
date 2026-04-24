import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// ProtectedRoute — bảo vệ route cần đăng nhập
// Đợi AuthContext restore session xong → kiểm tra user
// Nếu chưa login → redirect về /login
// Nếu đã login → render children bình thường
function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth()

  // Đang restore session từ localStorage → chờ, chưa redirect
  if (isLoading) {
    return null
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default ProtectedRoute
