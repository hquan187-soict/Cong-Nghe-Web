// Tạm thời — chờ Đức Phúc review
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { createSocket } from '../socket/socket'

const SocketContext = createContext(null)

/**
 * SocketProvider
 * - Chỉ connect khi user đã đăng nhập
 * - Disconnect + cleanup khi user logout
 * - Expose: socket instance, joinConversation(id), leaveConversation(id)
 *
 * Ghi chú về backend:
 * - Backend (socketAuthMiddleware) xác thực bằng cookie "jwt=" — không cần
 *   truyền token qua socket.handshake.auth
 * - Backend emit event "sendMessage" (không phải "new_message") với payload:
 *   { conversationId, message, lastMessage, updatedAt }
 * - Backend chưa implement join/leave room — ta dùng custom room ở client side
 *   (joinConversation/leaveConversation chỉ track local state để filter event)
 */
export function SocketProvider({ children }) {
  const { user } = useAuth()
  const socketRef = useRef(null)
  const [isConnected, setIsConnected] = useState(false)

  // Khởi tạo và connect socket khi user đăng nhập
  useEffect(() => {
    if (!user) {
      // User chưa đăng nhập hoặc đã logout → cleanup
      if (socketRef.current) {
        console.log('[SocketContext] User logout → disconnect socket')
        socketRef.current.disconnect()
        socketRef.current = null
        setIsConnected(false)
      }
      return
    }

    // Tạo socket instance mới (chỉ khi chưa có)
    if (!socketRef.current) {
      console.log('[SocketContext] User đã đăng nhập → tạo và connect socket')
      const socket = createSocket()
      socketRef.current = socket

      socket.on('connect', () => {
        console.log('[SocketContext] Socket connected:', socket.id)
        setIsConnected(true)
      })

      socket.on('disconnect', (reason) => {
        console.log('[SocketContext] Socket disconnected:', reason)
        setIsConnected(false)
      })

      socket.on('connect_error', (err) => {
        console.error('[SocketContext] Lỗi kết nối socket:', err.message)
      })

      socket.connect()
    }

    // Cleanup khi component unmount (App bị unmount)
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        setIsConnected(false)
      }
    }
  }, [user]) // Re-run khi user thay đổi (login/logout)

  /**
   * Join vào room của một conversation.
   * Nếu backend hỗ trợ room: socket.emit('join_conversation', id)
   * Hiện tại backend chưa implement room — hàm này chỉ emit để sẵn sàng cho sau.
   */
  const joinConversation = useCallback((conversationId) => {
    if (!socketRef.current || !conversationId) return
    if (conversationId.startsWith('mock_')) return // Bỏ qua mock conversations
    console.log('[SocketContext] joinConversation:', conversationId)
    socketRef.current.emit('join_conversation', conversationId)
  }, [])

  /**
   * Leave khỏi room của một conversation.
   */
  const leaveConversation = useCallback((conversationId) => {
    if (!socketRef.current || !conversationId) return
    if (conversationId.startsWith('mock_')) return
    console.log('[SocketContext] leaveConversation:', conversationId)
    socketRef.current.emit('leave_conversation', conversationId)
  }, [])

  const value = {
    socket: socketRef.current,
    isConnected,
    joinConversation,
    leaveConversation,
  }

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (context === null) {
    throw new Error('useSocket() phải được dùng bên trong <SocketProvider>')
  }
  return context
}
