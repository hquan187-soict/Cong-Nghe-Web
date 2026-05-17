import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { createSocket } from '../socket/socket'

const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const { user } = useAuth()
  const socketRef = useRef(null)
  const [isConnected, setIsConnected] = useState(false)
  const [socketInstance, setSocketInstance] = useState(null)
  const [onlineUsers, setOnlineUsers] = useState([])

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        setSocketInstance(null)
        setIsConnected(false)
        setOnlineUsers([])
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

      setSocketInstance(socket)
      socket.connect()
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        setSocketInstance(null)
        setIsConnected(false)
        setOnlineUsers([])
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

  const getUserLastSeen = useCallback((userId) => {
    return new Promise((resolve) => {
      if (!socketRef.current?.connected || !userId) {
        resolve(null)
        return
      }
      socketRef.current.emit('getUserLastSeen', userId, (data) => {
        resolve(data?.lastSeen || null)
      })
    })
  }, [])

  const value = {
    socket: socketInstance,
    isConnected,
    onlineUsers,
    joinConversation,
    leaveConversation,
    getUserLastSeen,
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
