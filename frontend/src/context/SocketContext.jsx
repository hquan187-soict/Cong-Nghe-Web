import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { createSocket } from '../socket/socket'

const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const { user } = useAuth()
  const socketRef = useRef(null)
  const [isConnected, setIsConnected] = useState(false)
  // State giữ socket instance — đảm bảo consumers re-render khi socket sẵn sàng
  const [socketInstance, setSocketInstance] = useState(null)
  // Quản lý danh sách online global
  const [onlineUsers, setOnlineUsers] = useState([])

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        setSocketInstance(null)
        setIsConnected(false)
      }
      return
    }

    if (!socketRef.current) {
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

      socket.on('getOnlineUsers', (userIds) => {
        setOnlineUsers(userIds)
      })

      socket.on('user_status', ({ userId, isOnline }) => {
        setOnlineUsers((prev) => {
          if (isOnline) {
            return prev.includes(userId) ? prev : [...prev, userId]
          } else {
            return prev.filter((id) => id !== userId)
          }
        })
      })

      // Expose socket qua state để trigger re-render cho consumers
      setSocketInstance(socket)
      socket.connect()
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        setSocketInstance(null)
        setIsConnected(false)
      }
    }
  }, [user])

  const joinConversation = useCallback((conversationId) => {
    if (!socketRef.current || !conversationId) return
    if (conversationId.startsWith('mock_')) return
    socketRef.current.emit('join_conversation', conversationId)
  }, [])

  const leaveConversation = useCallback((conversationId) => {
    if (!socketRef.current || !conversationId) return
    if (conversationId.startsWith('mock_')) return
    socketRef.current.emit('leave_conversation', conversationId)
  }, [])

  const value = {
    socket: socketInstance,
    isConnected,
    joinConversation,
    leaveConversation,
    onlineUsers,
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
