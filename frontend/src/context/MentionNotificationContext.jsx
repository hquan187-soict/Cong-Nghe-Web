import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useSocket } from './SocketContext'
import { useAuth } from './AuthContext'
import { useNotification } from './NotificationContext'
import { notificationService } from '../services/notification.service'
import { setUnreadNotifsCount } from '../utils/documentTitle'

const MentionNotificationContext = createContext()

export function MentionNotificationProvider({ children }) {
  const { socket, isConnected } = useSocket()
  const { user } = useAuth()
  const { playSound } = useNotification()

  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setUnreadNotifsCount(unreadCount)
  }, [unreadCount])
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)

  const [toastNotification, setToastNotification] = useState(null)
  const toastTimerRef = useRef(null)

  const navigateToMessageRef = useRef(null)

  const fetchNotifications = useCallback(async (pageNum = 1, append = false) => {
    setLoading(true)
    try {
      const data = await notificationService.getNotifications(pageNum, 20)
      if (append) {
        setNotifications(prev => [...prev, ...(data.notifications || [])])
      } else {
        setNotifications(data.notifications || [])
      }
      setUnreadCount(data.unreadCount || 0)
      setHasMore(data.pagination?.hasMore || false)
      setPage(pageNum)
    } catch (err) {
      console.error('Fetch notifications error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchNotifications(page + 1, true)
    }
  }, [loading, hasMore, page, fetchNotifications])

  useEffect(() => {
    if (user?._id) {
      fetchNotifications(1, false)
    }
  }, [user?._id, fetchNotifications])

  useEffect(() => {
    if (!socket?.connected || !user?._id) return

    const handleNewNotification = (notif) => {
      setNotifications(prev => [notif, ...prev])
      setUnreadCount(prev => prev + 1)

      playSound()

      setToastNotification(notif)
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      toastTimerRef.current = setTimeout(() => {
        setToastNotification(null)
      }, 5000)
    }

    socket.on('new_notification', handleNewNotification)
    return () => {
      socket.off('new_notification', handleNewNotification)
    }
  }, [socket, isConnected, user?._id, playSound])

  const dismissToast = useCallback(() => {
    setToastNotification(null)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
  }, [])

  const markAsRead = useCallback(async (notificationId) => {
    try {
      await notificationService.markAsRead(notificationId)
      setNotifications(prev =>
        prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Mark notification read error:', err)
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error('Mark all notifications read error:', err)
    }
  }, [])

  const setNavigateToMessage = useCallback((fn) => {
    navigateToMessageRef.current = fn
  }, [])

  const navigateToMessage = useCallback((conversationId, messageId) => {
    if (navigateToMessageRef.current) {
      navigateToMessageRef.current(conversationId, messageId)
    }
  }, [])

  return (
    <MentionNotificationContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      hasMore,
      loadMore,
      fetchNotifications,
      markAsRead,
      markAllAsRead,
      toastNotification,
      dismissToast,
      navigateToMessage,
      setNavigateToMessage,
    }}>
      {children}
    </MentionNotificationContext.Provider>
  )
}

export function useMentionNotification() {
  return useContext(MentionNotificationContext)
}
