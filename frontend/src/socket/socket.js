// Tạm thời — chờ Đức Phúc review
import { io } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL

/**
 * Tạo một socket instance mới được xác thực.
 *
 * Backend (socketAuthMiddleware) đọc JWT từ cookie "jwt=" — không cần truyền token
 * qua auth handshake. Socket.io sẽ tự gửi cookie kèm khi withCredentials = true.
 *
 * KHÔNG tạo socket khi import module — chỉ tạo khi hàm này được gọi.
 *
 * @returns {import('socket.io-client').Socket}
 */
export function createSocket() {
  const token = localStorage.getItem('auth_token');
  // Chỉ gửi token nếu là JWT thật (3 phần cách nhau bởi dấu chấm)
  const isRealJwt = token && token.split('.').length === 3;
  return io(API_URL, {
    auth: {
      token: isRealJwt ? token : undefined,
    },
    withCredentials: true,
    autoConnect: false,    // Chỉ connect khi gọi socket.connect() thủ công
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  })
}
