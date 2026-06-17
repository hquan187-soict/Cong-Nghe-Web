import { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef, useLayoutEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MessageCircle, User, Sun, Moon, Search, Settings, ChevronsLeft, ChevronsRight, Languages, Bell, Eye, Accessibility, ChevronRight, ChevronLeft, Type, ALargeSmall, MessageSquare, Users, UserPlus, Archive, Volume2, Play, Phone, Tag } from 'lucide-react'
import logoImg from '../../assets/logo.png'
import { conversationService } from '../../services/conversation.service'
import { messageService } from '../../services/message.service'
import { useLang } from '../../context/LangContext'
import { useTheme } from '../../context/ThemeContext'
import { useToast } from '../../context/ToastContext'
import { useAccessibility } from '../../context/AccessibilityContext'
import { useSocket } from '../../context/SocketContext'
import { useAuth } from '../../context/AuthContext'
import { useNotification } from '../../context/NotificationContext'
import { userService } from '../../services/user.service'
import ConversationItem from './ConversationItem'
import SearchUserModal from './SearchUserModal'
import CreateGroupModal from './CreateGroupModal'
import ConfirmModal from '../ui/ConfirmModal'
import NotificationBell from '../NotificationBell'
import CallHistoryPanel from '../call/CallHistoryPanel'
import { setUnreadChatsCount } from '../../utils/documentTitle'
import '../../styles/sidebar.css'

const Sidebar = forwardRef(function Sidebar({ selectedConversation, onSelectConversation, collapsed, collapseDisabled = false, onToggleCollapse, onlineUsers = [], onNotificationClick }, ref) {
  const { t, lang, toggleLang } = useLang()
  const { theme, toggleTheme } = useTheme()
  const toast = useToast()
  const navigate = useNavigate()
  const { fontSize, setFontSize, fontFamily, setFontFamily, FONT_SIZES, FONT_FAMILIES } = useAccessibility()
  const { socket } = useSocket()
  const { user, updateUser } = useAuth()
  const { soundEnabled, setSoundEnabled, selectedSound, setSelectedSound, previewSound, SOUND_OPTIONS } = useNotification()

  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState(() => {
    return searchParams.get('tab') === 'calls' ? 'calls' : 'chat'
  })
  const [conversations, setConversations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  
  const [showSettings, setShowSettings] = useState(false)
  const [showAccessibility, setShowAccessibility] = useState(false)
  const [showActiveStatus, setShowActiveStatus] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [activeStatusEnabled, setActiveStatusEnabled] = useState(() => {
    const saved = localStorage.getItem('active_status_enabled')
    return saved !== null ? saved === 'true' : true
  })
  
  const settingsRef = useRef(null)
  const settingsBtnRef = useRef(null)
  const dropdownRef = useRef(null)
  const a11yPanelRef = useRef(null)
  const handleMuteRef = useRef(null)
  const activeStatusPanelRef = useRef(null)
  const activeStatusBtnRef = useRef(null)
  const notifPanelRef = useRef(null)
  const notifBtnRef = useRef(null)
  const [dropdownStyle, setDropdownStyle] = useState({})
  const [a11yPanelStyle, setA11yPanelStyle] = useState({})
  const [activeStatusPanelStyle, setActiveStatusPanelStyle] = useState({})
  const [notifPanelStyle, setNotifPanelStyle] = useState({})

  function getMobileSettingsPanelStyle(anchorRect) {
    const bottom = Math.max(12, window.innerHeight - anchorRect.bottom)
    return {
      left: 12,
      right: 12,
      bottom,
      width: 'auto',
      maxWidth: 'none',
      maxHeight: `calc(100dvh - ${bottom + 12}px)`,
      overflowY: 'auto',
    }
  }

  const [unreadMap, setUnreadMap] = useState({})
  const [pinMap, setPinMap] = useState({})
  const [muteMap, setMuteMap] = useState({})
  const [activeFilter, setActiveFilter] = useState('all') // 'all' | 'unread' | 'archived' | 'label:...'
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)

  useImperativeHandle(ref, () => ({
    updateLastMessage(conversationId, lastMessage) {
      setConversations((prev) => {
        const exists = prev.some((c) => c._id === conversationId)
        if (!exists) {
          // Nếu đoạn chat không tồn tại trên UI (do bị xóa), gọi API fetch lại để lấy dữ liệu mới nhất
          conversationService.getConversations().then(res => {
            const allConvs = Array.isArray(res) ? res : (res.data || []);
            const match = allConvs.find(c => c._id === conversationId);
            if (match) {
              setConversations(old => {
                if (old.some(c => c._id === conversationId)) return old;
                return [match, ...old];
              });
            }
          }).catch(console.error);
          return prev;
        }

        const updated = prev.map((conv) =>
          conv._id === conversationId
            ? {
                ...conv,
                lastMessage,
                updatedAt: lastMessage.createdAt || new Date().toISOString(),
              }
            : conv
        )
        return updated
      })
    },

    clearUnread(conversationId) {
      setUnreadMap((prev) => {
        const next = { ...prev }
        delete next[conversationId]
        return next
      })
    },

    incrementUnread(conversationId) {
      setUnreadMap((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] || 0) + 1,
      }))
    },

    updateConversationDetails(updatedConv) {
      setConversations((prev) =>
        prev.map((conv) =>
          conv._id === updatedConv._id ? { ...conv, ...updatedConv } : conv
        )
      )
    },

    removeConversation(conversationId) {
      setConversations((prev) => prev.filter((conv) => conv._id !== conversationId))
    },

    unarchiveConversation(conversationId) {
      const uid = user?._id?.toString()
      if (!uid) return
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv._id !== conversationId) return conv
          const filtered = (conv.archivedBy || []).filter(
            id => (id._id || id).toString() !== uid
          )
          return { ...conv, archivedBy: filtered }
        })
      )
    },

    isConversationMuted(conversationId) {
      return !!muteMap[conversationId]
    },

    handleMute(conversationId) {
      return handleMuteRef.current?.(conversationId)
    },
  }), [muteMap])

  useEffect(() => {
    if (user?.showActiveStatus !== undefined) {
      setActiveStatusEnabled(user.showActiveStatus)
      localStorage.setItem('active_status_enabled', String(user.showActiveStatus))
    }
  }, [user?.showActiveStatus])

  const handleToggleActiveStatus = useCallback(async (enabled) => {
    setActiveStatusEnabled(enabled)
    localStorage.setItem('active_status_enabled', String(enabled))
    try {
      const updatedUser = await userService.toggleActiveStatus(enabled)
      if (updatedUser) {
        updateUser(updatedUser)
      }
      if (socket?.connected) {
        socket.emit('toggleActiveStatus', enabled)
      }
    } catch (err) {
      console.error('Toggle active status error:', err)
    }
  }, [socket, updateUser])

  useEffect(() => {
    let cancelled = false

    async function fetchConversations() {
      setIsLoading(true)
      try {
        const data = await conversationService.getConversations()
        if (!cancelled) {
          const list = Array.isArray(data) ? data : []
          setConversations(list)
          
          const uMap = {}
          const pMap = {}
          const mMap = {}
          
          list.forEach((conv) => {
            const isMarkedUnread = conv.markedUnreadBy?.includes(user?._id?.toString() || user?._id);
            if ((conv.unreadCount && conv.unreadCount > 0) || isMarkedUnread) {
              uMap[conv._id] = conv.unreadCount || 1
            }
            if (conv.isPinned) pMap[conv._id] = true
            if (conv.isMuted) mMap[conv._id] = true
          })
          
          setUnreadMap(uMap)
          setPinMap(pMap)
          setMuteMap(mMap)
        }
      } catch (err) {
        console.error('Fetch conversations error:', err)
        if (!cancelled) {
          toast.error(t('chat.loadError'))
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchConversations()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!socket?.connected) return

    const handleNewConversation = ({ conversation: newConv }) => {
      if (!newConv) return
      setConversations((prev) => {
        const exists = prev.some((c) => c._id === newConv._id)
        if (exists) return prev
        return [newConv, ...prev]
      })
    }

    const handleConversationUpdated = ({ conversation: updatedConv }) => {
      if (!updatedConv) return
      setConversations((prev) =>
        prev.map((conv) =>
          conv._id === updatedConv._id ? { ...conv, ...updatedConv } : conv
        )
      )
    }

    const handleMessagesRead = ({ conversationId }) => {
      setUnreadMap((prev) => {
        if (!prev[conversationId]) return prev
        const next = { ...prev }
        delete next[conversationId]
        return next
      })
    }

    socket.on('newConversation', handleNewConversation)
    socket.on('conversationUpdated', handleConversationUpdated)
    socket.on('nicknameUpdated', handleConversationUpdated)
    socket.on('messagesRead', handleMessagesRead)

    return () => {
      socket.off('newConversation', handleNewConversation)
      socket.off('conversationUpdated', handleConversationUpdated)
      socket.off('nicknameUpdated', handleConversationUpdated)
      socket.off('messagesRead', handleMessagesRead)
    }
  }, [socket])

  useEffect(() => {
    const sum = Object.values(unreadMap).reduce((a, b) => a + (b || 0), 0)
    setUnreadChatsCount(sum)
  }, [unreadMap])

  const handleSelectConversation = useCallback(async (conv) => {
    onSelectConversation(conv)
    setUnreadMap((prev) => {
      if (!prev[conv._id]) return prev
      const next = { ...prev }
      delete next[conv._id]
      return next
    })
    
    // Nếu chuyển status thành đã đọc, cũng nên xóa markedUnreadBy nếu có
    if (conv.markedUnreadBy?.includes(user?._id?.toString() || user?._id)) {
      setConversations(prev => prev.map(c => 
        c._id === conv._id 
          ? { ...c, markedUnreadBy: c.markedUnreadBy.filter(id => id !== user?._id?.toString() && id !== user?._id) } 
          : c
      ))
    }

    if (!conv._id.startsWith('mock_') && !conv._id.startsWith('conv_')) {
      try {
        await messageService.markAsRead(conv._id)
      } catch (err) {
        console.error('Mark as read error:', err)
      }
    }
  }, [onSelectConversation, user?._id])

  const handleConversationCreated = useCallback((newConversation) => {
    setConversations((prev) => {
      const exists = prev.some((c) => c._id === newConversation._id)
      if (exists) {
        return [
          newConversation,
          ...prev.filter((c) => c._id !== newConversation._id),
        ]
      }
      return [newConversation, ...prev]
    })
    
    // Copy initial pinned/muted status
    if (newConversation.isPinned) setPinMap(prev => ({ ...prev, [newConversation._id]: true }))
    if (newConversation.isMuted) setMuteMap(prev => ({ ...prev, [newConversation._id]: true }))
    
    onSelectConversation(newConversation)
  }, [onSelectConversation])

  const handlePin = useCallback(async (convId) => {
    const prevPinned = !!pinMap[convId]
    setPinMap(prev => ({ ...prev, [convId]: !prev[convId] }))
    try {
      const updatedConv = await conversationService.togglePinConversation(convId)
      setConversations(prev =>
        prev.map(conv => conv._id === convId ? { ...conv, ...updatedConv } : conv)
      )
      const uid = user?._id?.toString()
      const nowPinned = updatedConv.pinnedBy?.some(id => (id._id || id).toString() === uid)
      setPinMap(prev => ({ ...prev, [convId]: !!nowPinned }))
      toast.success(nowPinned ? t('chat2.pinnedToast') : t('chat2.unpinnedToast'))
    } catch {
      setPinMap(prev => ({ ...prev, [convId]: prevPinned }))
      toast.error(t('common.error'))
    }
  }, [pinMap, user?._id])

  const handleMute = useCallback(async (convId) => {
    const prevMuted = !!muteMap[convId]
    setMuteMap(prev => ({ ...prev, [convId]: !prev[convId] }))
    try {
      const updatedConv = await conversationService.toggleMuteConversation(convId)
      setConversations(prev =>
        prev.map(conv => conv._id === convId ? { ...conv, ...updatedConv } : conv)
      )
      const uid = user?._id?.toString()
      const nowMuted = updatedConv.mutedBy?.some(id => (id._id || id).toString() === uid)
      setMuteMap(prev => ({ ...prev, [convId]: !!nowMuted }))
      toast.success(nowMuted ? t('chat2.mutedToast') : t('chat2.unmutedToast'))
      return updatedConv
    } catch {
      setMuteMap(prev => ({ ...prev, [convId]: prevMuted }))
      toast.error(t('common.error'))
      return null
    }
  }, [muteMap, user?._id])
  handleMuteRef.current = handleMute

  const handleArchive = useCallback(async (convId) => {
    try {
      const updatedConv = await conversationService.toggleArchiveConversation(convId)
      const uid = user?._id?.toString()
      const isNowArchived = updatedConv.archivedBy?.some(
        id => (id._id || id).toString() === uid
      )
      setConversations(prev =>
        prev.map(c => {
          if (c._id !== convId) return c
          return { ...c, archivedBy: updatedConv.archivedBy }
        })
      )
      if (isNowArchived) {
        setPinMap(prev => ({ ...prev, [convId]: false }))
      }
      toast.success(isNowArchived ? t('chat2.archivedToast') : t('chat2.unarchivedToast'))
      if (isNowArchived && selectedConversation?._id === convId) {
        onSelectConversation(null)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra')
    }
  }, [selectedConversation, onSelectConversation, toast, user])

  const handleLeaveGroup = useCallback(async (convId) => {
    if (!window.confirm(t('chat.leaveGroupConfirm') || 'Bạn có chắc chắn muốn rời nhóm?')) return
    try {
      await conversationService.leaveGroup(convId)
      setConversations(prev => prev.filter(c => c._id !== convId))
      setPinMap(prev => { const next = { ...prev }; delete next[convId]; return next })
      if (selectedConversation?._id === convId) {
        onSelectConversation(null)
      }
      toast.success(t('chat.leftGroup') || 'Đã rời nhóm thành công!')
    } catch (err) {
      console.error('Leave group error:', err)
      toast.error(err.response?.data?.message || t('common.error'))
    }
  }, [selectedConversation, onSelectConversation, t, toast])

  const [confirmModalData, setConfirmModalData] = useState({ isOpen: false, type: null, convId: null, otherId: null })

  const confirmAction = async () => {
    const { type, convId, otherId } = confirmModalData;
    
    setConfirmModalData(prev => ({ ...prev, isOpen: false }));

    if (type === 'deleteChat') {
      try {
        await conversationService.deleteChat(convId)
        setConversations(prev => prev.filter(c => c._id !== convId))
        setUnreadMap(prev => {
          if (!prev[convId]) return prev
          const next = { ...prev }
          delete next[convId]
          return next
        })
        setPinMap(prev => { const next = { ...prev }; delete next[convId]; return next })
        if (selectedConversation?._id === convId) {
          onSelectConversation(null)
        }
        toast.success(t('chat2.deletedToast'))
      } catch (err) {
        console.error('Delete chat error:', err)
        toast.error(err?.response?.data?.message || t('chat2.deleteError'))
      }
      return;
    }

    if (!otherId) return;

    if (type === 'block') {
      try {
        const updatedUser = await userService.blockUser(otherId)
        if (updatedUser) updateUser(updatedUser)
        const uid = user?._id?.toString()
        setConversations(prev => prev.map(c => {
          if (c._id !== convId) return c
          const archivedBy = c.archivedBy || []
          const alreadyArchived = archivedBy.some(id => (id._id || id).toString() === uid)
          return { ...c, archivedBy: alreadyArchived ? archivedBy : [...archivedBy, uid] }
        }))
        toast.success(t('chat.blockSuccess') || 'Đã chặn người dùng')
      } catch (err) {
        toast.error(err.response?.data?.message || 'Có lỗi xảy ra')
      }
    } else if (type === 'unblock') {
      try {
        const updatedUser = await userService.unblockUser(otherId)
        if (updatedUser) updateUser(updatedUser)
        const uid = user?._id?.toString()
        setConversations(prev => prev.map(c => {
          if (c._id !== convId) return c
          const filtered = (c.archivedBy || []).filter(id => (id._id || id).toString() !== uid)
          return { ...c, archivedBy: filtered }
        }))
        toast.success(t('chat.unblockSuccess') || 'Đã bỏ chặn người dùng')
      } catch (err) {
        toast.error(err.response?.data?.message || 'Có lỗi xảy ra')
      }
    }
  }

  const markingReadRef = useRef({})
  const handleMarkRead = useCallback(async (convId) => {
    if (markingReadRef.current[convId]) return
    if (!unreadMap[convId]) return

    setUnreadMap((prev) => {
      const next = { ...prev }
      delete next[convId]
      return next
    })

    // Xóa khỏi markedUnreadBy trong state
    setConversations(prev => prev.map(c => 
      c._id === convId && c.markedUnreadBy 
        ? { ...c, markedUnreadBy: c.markedUnreadBy.filter(id => id !== user?._id?.toString() && id !== user?._id) } 
        : c
    ))

    markingReadRef.current[convId] = true
    try {
      await messageService.markAsRead(convId)
    } catch (err) {
      console.error('Mark as read error:', err)
    } finally {
      setTimeout(() => {
        markingReadRef.current[convId] = false
      }, 1000)
    }
  }, [unreadMap, user?._id])

  const handleMarkUnread = useCallback(async (convId) => {
    setUnreadMap(prev => ({
      ...prev,
      [convId]: 1
    }))
    
    // Cập nhật state
    setConversations(prev => prev.map(c => {
      if (c._id !== convId) return c
      const uid = user?._id?.toString() || user?._id
      const marked = c.markedUnreadBy || []
      return marked.includes(uid) ? c : { ...c, markedUnreadBy: [...marked, uid] }
    }))

    try {
      await conversationService.markAsUnread(convId)
    } catch (err) {
      console.error('Mark as unread error:', err)
    }
  }, [user?._id])
  const handleUpdateLabel = useCallback(async (convId, label) => {
    setConversations(prev => prev.map(c => {
      if (c._id !== convId) return c
      const uid = user?._id?.toString() || user?._id
      let newLabels = {};
      if (c.labels instanceof Map) {
        newLabels = Object.fromEntries(c.labels);
      } else {
        newLabels = { ...(c.labels || {}) };
      }
      
      if (label) {
        newLabels[uid] = label;
      } else {
        delete newLabels[uid];
      }
      return { ...c, labels: newLabels }
    }))
    try {
      await conversationService.updateLabel(convId, label)
    } catch (err) {
      console.error('Update label error:', err)
      toast.error(t('chat2.labelError'))
    }
  }, [user?._id, toast])

  const handleDeleteChat = useCallback((convId) => {
    setConfirmModalData({ isOpen: true, type: 'deleteChat', convId, otherId: null })
  }, [])

  const handleBlock = useCallback((convId, otherMemberId) => {
    if (!otherMemberId) return
    setConfirmModalData({ isOpen: true, type: 'block', convId, otherId: otherMemberId })
  }, [])

  const handleUnblock = useCallback((convId, otherMemberId) => {
    if (!otherMemberId) return
    setConfirmModalData({ isOpen: true, type: 'unblock', convId, otherId: otherMemberId })
  }, [])

  useEffect(() => {
    function handleClickOutside(e) {
      const clickedInSettings = settingsRef.current?.contains(e.target)
      const clickedInDropdown = dropdownRef.current?.contains(e.target)
      const clickedInA11y = a11yPanelRef.current?.contains(e.target)
      const clickedInActiveStatus = activeStatusPanelRef.current?.contains(e.target)
      const clickedInNotif = notifPanelRef.current?.contains(e.target)
      if (!clickedInSettings && !clickedInDropdown && !clickedInA11y && !clickedInActiveStatus && !clickedInNotif) {
        setShowSettings(false)
        setShowAccessibility(false)
        setShowActiveStatus(false)
        setShowNotifications(false)
      }
    }
    if (showSettings || showAccessibility || showActiveStatus || showNotifications) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSettings, showAccessibility, showActiveStatus, showNotifications])

  useLayoutEffect(() => {
    if (!showSettings || !settingsBtnRef.current) return
    const rect = settingsBtnRef.current.getBoundingClientRect()
    if (collapsed) {
      setDropdownStyle({
        left: rect.right + 8,
        bottom: window.innerHeight - rect.bottom,
      })
    } else {
      setDropdownStyle({
        left: rect.left,
        bottom: window.innerHeight - rect.top + 8,
      })
    }
  }, [showSettings, collapsed])

  useLayoutEffect(() => {
    if (!showAccessibility || !dropdownRef.current) return
    const rect = dropdownRef.current.getBoundingClientRect()
    if (collapseDisabled) {
      setA11yPanelStyle(getMobileSettingsPanelStyle(rect))
      return
    }
    setA11yPanelStyle({
      left: rect.right + 8,
      bottom: window.innerHeight - rect.bottom,
    })
  }, [showAccessibility, collapseDisabled])

  useLayoutEffect(() => {
    if (!showActiveStatus || !dropdownRef.current) return
    const dropdownRect = dropdownRef.current.getBoundingClientRect()
    if (collapseDisabled) {
      setActiveStatusPanelStyle(getMobileSettingsPanelStyle(dropdownRect))
      return
    }
    setActiveStatusPanelStyle({
      left: dropdownRect.right + 8,
      bottom: window.innerHeight - dropdownRect.bottom,
    })
  }, [showActiveStatus, collapseDisabled])

  useLayoutEffect(() => {
    if (!showNotifications || !dropdownRef.current) return
    const dropdownRect = dropdownRef.current.getBoundingClientRect()
    if (collapseDisabled) {
      setNotifPanelStyle(getMobileSettingsPanelStyle(dropdownRect))
      return
    }
    setNotifPanelStyle({
      left: dropdownRect.right + 8,
      bottom: window.innerHeight - dropdownRect.bottom,
    })
  }, [showNotifications, collapseDisabled])

  const handleSearchBarClick = () => {
    setShowSearchModal(true)
  }

  const currentUserIdSidebar = user?._id?.toString()

  // Filter and Sort logic
  const displayedConversations = useMemo(() => {
    let filtered = conversations

    // Check archived status per conversation
    const isConvArchived = (conv) => {
      return conv.archivedBy?.some(id => (id._id || id).toString() === currentUserIdSidebar)
    }

    // 1. Filter
    if (activeFilter === 'archived') {
      filtered = filtered.filter(conv => isConvArchived(conv))
    } else if (activeFilter.startsWith('label:')) {
      const targetLabel = activeFilter.split(':')[1];
      filtered = filtered.filter(conv => {
         if (isConvArchived(conv)) return false;
         const uid = currentUserIdSidebar;
         const lbl = conv.labels ? (conv.labels instanceof Map ? conv.labels.get(uid) : conv.labels[uid]) : null;
         return lbl === targetLabel;
      });
    } else {
      filtered = filtered.filter(conv => !isConvArchived(conv))
      if (activeFilter === 'unread') {
        filtered = filtered.filter(conv => (unreadMap[conv._id] || 0) > 0)
      }
    }

    // 2. Map properties from local state maps for rendering
    filtered = filtered.map(conv => ({
      ...conv,
      isPinned: !!pinMap[conv._id],
      isMuted: !!muteMap[conv._id]
    }))

    // 3. Sort (pinned first, then by updatedAt)
    return filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1

      const timeA = new Date(a.lastMessage?.createdAt || a.updatedAt || 0).getTime()
      const timeB = new Date(b.lastMessage?.createdAt || b.updatedAt || 0).getTime()
      return timeB - timeA
    })
  }, [conversations, unreadMap, pinMap, muteMap, activeFilter, currentUserIdSidebar])

  const archivedCount = useMemo(() => {
    return conversations.filter(conv =>
      conv.archivedBy?.some(id => (id._id || id).toString() === currentUserIdSidebar)
    ).length
  }, [conversations, currentUserIdSidebar])

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      {/* Top Nav */}
      {collapsed ? (
        <div className="sidebar-nav-vertical" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: 'calc(12px + var(--safe-area-top)) 0 12px', borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-surface)', width: '100%', alignItems: 'center' }}>
          <button
            className="sidebar-nav__tab-vertical"
            style={{ width: '40px', height: '40px', background: activeTab === 'chat' ? 'var(--color-primary-light)' : 'transparent', border: 'none', borderRadius: '50%', color: activeTab === 'chat' ? 'var(--color-primary)' : 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setActiveTab('chat')}
            title={t('chat.title')}
          >
            <MessageSquare size={20} />
          </button>
          <button
            className="sidebar-nav__tab-vertical"
            style={{ width: '40px', height: '40px', background: activeTab === 'calls' ? 'var(--color-primary-light)' : 'transparent', border: 'none', borderRadius: '50%', color: activeTab === 'calls' ? 'var(--color-primary)' : 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setActiveTab('calls')}
            title={t('call.history')}
          >
            <Phone size={20} />
          </button>
          <button
            className="sidebar-nav__tab-vertical"
            style={{ width: '40px', height: '40px', background: 'transparent', border: 'none', borderRadius: '50%', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => navigate('/contacts')}
            title={t('contacts.title')}
          >
            <Users size={20} />
          </button>
        </div>
      ) : (
        <div className="sidebar-nav" style={{ display: 'flex', paddingTop: 'var(--safe-area-top)', borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-surface)' }}>
          <button
            className="sidebar-nav__tab"
            style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', borderBottom: activeTab === 'chat' ? '2px solid var(--color-primary)' : '2px solid transparent', color: activeTab === 'chat' ? 'var(--color-primary)' : 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}
            onClick={() => setActiveTab('chat')}
          >
            <MessageSquare size={18} /> {t('chat.title')}
          </button>
          <button
            className="sidebar-nav__tab"
            style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', borderBottom: activeTab === 'calls' ? '2px solid var(--color-primary)' : '2px solid transparent', color: activeTab === 'calls' ? 'var(--color-primary)' : 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}
            onClick={() => setActiveTab('calls')}
          >
            <Phone size={18} /> {t('call.history')}
          </button>
          <button
            className="sidebar-nav__tab"
            style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', borderBottom: '2px solid transparent', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}
            onClick={() => navigate('/contacts')}
          >
            <Users size={18} /> {t('contacts.title')}
          </button>
        </div>
      )}

      {/* Header — Logo + Title */}
      <div className="sidebar__header" style={collapsed ? {} : { paddingBottom: '8px' }}>
        <div className="sidebar__header-left">
          <img
            src={logoImg}
            alt="HUST Messenger"
            className="sidebar__logo sidebar__logo--draggable"
            draggable="true"
            onDragStart={(e) => {
              e.dataTransfer.setData('application/x-hust-logo', 'true')
              e.dataTransfer.setData('text/plain', '')
              e.dataTransfer.effectAllowed = 'copy'
            }}
            title={t('chat2.dragLogoHint')}
          />
          {!collapsed && (
            <h2 className="sidebar__title">HUST Messenger</h2>
          )}
        </div>
        {!collapsed && activeTab === 'chat' && (
          <div className="sidebar__header-right" style={{ display: 'flex', gap: '4px' }}>
            <NotificationBell onNotificationClick={onNotificationClick} />
            <button
              className="sidebar__icon-btn"
              onClick={() => setShowCreateGroupModal(true)}
              title={t('chat.createGroup')}
            >
              <UserPlus size={18} />
            </button>
          </div>
        )}
      </div>

      {activeTab === 'calls' ? (
        <>
          <div className="sidebar__divider" />
          <div className="sidebar__list">
            <CallHistoryPanel onSelectConversation={onSelectConversation} collapsed={collapsed} />
          </div>
        </>
      ) : (
        <>
          {/* Avatar + Search bar row */}
          {!collapsed && (
            <>
              <div className="sidebar__search" style={{ paddingBottom: '8px' }}>
                <div className="sidebar__search-row">
                  <button
                    className="sidebar__profile-btn"
                    title={t('profile.title')}
                    onClick={() => navigate('/profile')}
                    style={user?.avatar ? { padding: 0, overflow: 'hidden' } : {}}
                  >
                    {user?.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.fullName || 'Profile'}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <User size={18} />
                    )}
                  </button>
                  <div className="sidebar__search-bar" onClick={handleSearchBarClick} style={{ flex: 1 }}>
                    <Search size={16} className="sidebar__search-icon" />
                    <span className="sidebar__search-placeholder">
                      {t('chat.searchPlaceholder')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="sidebar-filter" style={{ display: 'flex', gap: '8px', padding: '0 16px 8px' }}>
                <button
                  onClick={() => setActiveFilter('all')}
                  style={{ padding: '6px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                    background: activeFilter === 'all' ? 'var(--color-primary-light)' : 'transparent',
                    color: activeFilter === 'all' ? 'var(--color-primary)' : 'var(--color-text-muted)'
                  }}
                >
                  {t('chat.filterAll')}
                </button>
                <button
                  onClick={() => setActiveFilter('unread')}
                  style={{ padding: '6px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                    background: activeFilter === 'unread' ? 'var(--color-primary-light)' : 'transparent',
                    color: activeFilter === 'unread' ? 'var(--color-primary)' : 'var(--color-text-muted)'
                  }}
                >
                  {t('chat.filterUnread')}
                </button>
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                    style={{ padding: '6px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                      background: activeFilter.startsWith('label:') ? 'var(--color-primary-light)' : 'transparent',
                      color: activeFilter.startsWith('label:') ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    {t('chat2.labelTitle')} <ChevronRight size={14} style={{ transform: showFilterDropdown ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                  </button>
                  {showFilterDropdown && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', minWidth: '150px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: '4px 0', zIndex: 100 }}>
                      {[
                        { label: t('chat2.labelCustomer'), color: '#ef4444', key: 'Khách hàng' },
                        { label: t('chat2.labelFamily'), color: '#22c55e', key: 'Gia đình' },
                        { label: t('chat2.labelWork'), color: '#f97316', key: 'Công việc' },
                        { label: t('chat2.labelFriends'), color: '#a855f7', key: 'Bạn bè' },
                        { label: t('chat2.labelOther'), color: '#eab308', key: 'Khác' }
                      ].map(opt => (
                        <button
                          key={opt.label}
                          className="sidebar__settings-item"
                          style={{ padding: '8px 16px', border: 'none', background: 'transparent', width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px', color: activeFilter === `label:${opt.label}` ? 'var(--color-primary)' : 'var(--color-text)' }}
                          onClick={() => {
                            setActiveFilter(`label:${opt.label}`);
                            setShowFilterDropdown(false);
                          }}
                        >
                          <Tag size={14} color={opt.color} style={{ marginRight: 8 }} />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {archivedCount > 0 && (
                  <button
                    onClick={() => setActiveFilter(activeFilter === 'archived' ? 'all' : 'archived')}
                    style={{ padding: '6px 12px', borderRadius: '16px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                      background: activeFilter === 'archived' ? 'var(--color-primary-light)' : 'transparent',
                      color: activeFilter === 'archived' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    <Archive size={12} />
                    {t('chat2.archivedFilter')} ({archivedCount})
                  </button>
                )}
              </div>
            </>
          )}

          <div className="sidebar__divider" />

          {/* Conversation list */}
          <div className="sidebar__list">
            {isLoading && (
              <div className="sidebar__loading">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="sidebar__skeleton">
                    <div className="sidebar__skeleton-avatar"></div>
                    {!collapsed && (
                      <div className="sidebar__skeleton-content">
                        <div className="sidebar__skeleton-line sidebar__skeleton-line--short"></div>
                        <div className="sidebar__skeleton-line sidebar__skeleton-line--long"></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!isLoading && displayedConversations.length === 0 && (
              <div className="sidebar__empty">
                <MessageCircle size={40} className="sidebar__empty-icon" />
                {!collapsed && (
                  <>
                    <p className="sidebar__empty-title">{t('chat.noConversations')}</p>
                    <p className="sidebar__empty-subtitle">{t('chat.startConversation')}</p>
                  </>
                )}
              </div>
            )}

            {!isLoading && displayedConversations.map((conv) => (
              <ConversationItem
                key={conv._id}
                conversation={conv}
                isActive={selectedConversation?._id === conv._id}
                onClick={() => handleSelectConversation(conv)}
                unreadCount={unreadMap[conv._id] || 0}
                collapsed={collapsed}
                onlineUsers={onlineUsers}
                onPin={handlePin}
                onMute={handleMute}
                onArchive={handleArchive}
                onLeaveGroup={handleLeaveGroup}
                onBlock={handleBlock}
                onUnblock={handleUnblock}
                onMarkRead={handleMarkRead}
                onMarkUnread={handleMarkUnread}
                onDeleteChat={handleDeleteChat}
                onUpdateLabel={handleUpdateLabel}
              />
            ))}
          </div>
        </>
      )}

      {/* Footer — Settings + Toggle */}
      <div className="sidebar__footer">
        {collapsed ? (
          <>
            <div className="sidebar__footer-col" ref={settingsRef}>
              <button
                ref={settingsBtnRef}
                className={`sidebar__footer-btn tooltip-wrapper ${showSettings ? 'sidebar__footer-btn--active' : ''}`}
                onClick={() => { setShowSettings((v) => !v); setShowAccessibility(false) }}
              >
                <Settings size={20} />
                {!showSettings && <span className="tooltip tooltip--right">{t('settings.title')}</span>}
              </button>
            </div>
            {!collapseDisabled && (
              <button
                className="sidebar__footer-btn tooltip-wrapper"
                onClick={onToggleCollapse}
              >
                <ChevronsRight size={20} />
                <span className="tooltip tooltip--right">{t('chat.expandSidebar')}</span>
              </button>
            )}
          </>
        ) : (
          <div className="sidebar__footer-row" ref={settingsRef}>
            <div className="sidebar__footer-settings-wrapper">
              <button
                ref={settingsBtnRef}
                className={`sidebar__footer-btn tooltip-wrapper ${showSettings ? 'sidebar__footer-btn--active' : ''}`}
                onClick={() => { setShowSettings((v) => !v); setShowAccessibility(false) }}
              >
                <Settings size={20} />
                {!showSettings && <span className="tooltip tooltip--top">{t('settings.title')}</span>}
              </button>
            </div>
            {!collapseDisabled && (
              <button
                className="sidebar__footer-btn tooltip-wrapper"
                onClick={onToggleCollapse}
              >
                <ChevronsLeft size={20} />
                <span className="tooltip tooltip--top">{t('chat.collapseSidebar')}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Settings dropdown — rendered as fixed portal */}
      {showSettings && (
        <div className="sidebar__settings-dropdown" ref={dropdownRef} style={dropdownStyle}>
          <div className="sidebar__settings-header">
            <Settings size={16} />
            <span>{t('settings.title')}</span>
          </div>
          <div className="sidebar__settings-divider" />
          <button className="sidebar__settings-item" onClick={toggleTheme}>
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            <div className="sidebar__settings-item-text">
              <span>{t('settings.theme')}</span>
            </div>
            <span className="sidebar__settings-value">
              {theme === 'light' ? t('settings.lightMode') : t('settings.darkMode')}
            </span>
          </button>
          <button className="sidebar__settings-item" onClick={toggleLang}>
            <Languages size={16} />
            <div className="sidebar__settings-item-text">
              <span>{t('settings.language')}</span>
            </div>
            <span className="sidebar__settings-value">{lang === 'vi' ? 'Tiếng Việt' : 'English'}</span>
          </button>
          <div className="sidebar__settings-divider" />
          <button ref={notifBtnRef} className="sidebar__settings-item" onClick={() => { setShowNotifications(true); setShowAccessibility(false); setShowActiveStatus(false) }}>
            <Bell size={16} />
            <div className="sidebar__settings-item-text">
              <span>{t('settings.notifications')}</span>
              <span className="sidebar__settings-desc">{t('settings.notificationsDesc')}</span>
            </div>
            <ChevronRight size={14} className="sidebar__settings-arrow" />
          </button>
          <button ref={activeStatusBtnRef} className="sidebar__settings-item" onClick={() => { setShowActiveStatus(true); setShowAccessibility(false); setShowNotifications(false) }}>
            <Eye size={16} />
            <div className="sidebar__settings-item-text">
              <span>{t('settings.activeStatus')}</span>
              <span className="sidebar__settings-desc">{t('settings.activeStatusDesc')}</span>
            </div>
            <ChevronRight size={14} className="sidebar__settings-arrow" />
          </button>
          <button className="sidebar__settings-item" onClick={() => { setShowAccessibility(true); setShowActiveStatus(false); setShowNotifications(false) }}>
            <Accessibility size={16} />
            <div className="sidebar__settings-item-text">
              <span>{t('settings.accessibility')}</span>
              <span className="sidebar__settings-desc">{t('settings.accessibilityDesc')}</span>
            </div>
            <ChevronRight size={14} className="sidebar__settings-arrow" />
          </button>
        </div>
      )}

      {/* Accessibility sub-panel */}
      {showAccessibility && showSettings && (
        <div className="sidebar__a11y-panel" ref={a11yPanelRef} style={a11yPanelStyle}>
          <div className="sidebar__settings-header">
            <button className="sidebar__a11y-back" onClick={() => setShowAccessibility(false)}>
              <ChevronLeft size={16} />
            </button>
            <span>{t('settings.accessibility')}</span>
          </div>
          <div className="sidebar__settings-divider" />

          <div className="sidebar__a11y-section">
            <div className="sidebar__a11y-label">
              <ALargeSmall size={15} />
              <span>{t('settings.fontSize')}</span>
            </div>
            <div className="sidebar__a11y-options">
              {FONT_SIZES.map((s) => (
                <button
                  key={s.value}
                  className={`sidebar__a11y-option ${fontSize === s.value ? 'sidebar__a11y-option--active' : ''}`}
                  onClick={() => setFontSize(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar__settings-divider" />

          <div className="sidebar__a11y-section">
            <div className="sidebar__a11y-label">
              <Type size={15} />
              <span>{t('settings.fontFamily')}</span>
            </div>
            <div className="sidebar__a11y-font-list">
              {FONT_FAMILIES.map((f) => (
                <button
                  key={f.value}
                  className={`sidebar__a11y-font-item ${fontFamily === f.value ? 'sidebar__a11y-font-item--active' : ''}`}
                  onClick={() => setFontFamily(f.value)}
                  style={{ fontFamily: f.value }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active Status sub-panel */}
      {showActiveStatus && showSettings && (
        <div className="sidebar__active-status-panel" ref={activeStatusPanelRef} style={activeStatusPanelStyle}>
          <div className="sidebar__settings-header">
            <button className="sidebar__a11y-back" onClick={() => setShowActiveStatus(false)}>
              <ChevronLeft size={16} />
            </button>
            <span>{t('settings.activeStatus')}</span>
          </div>
          <div className="sidebar__settings-divider" />

          <div className="sidebar__a11y-section">
            <div className="sidebar__active-status-toggle">
              <span className="sidebar__active-status-label">{t('settings.activeStatusToggle')}</span>
              <button
                className={`sidebar__toggle-switch ${activeStatusEnabled ? 'sidebar__toggle-switch--on' : ''}`}
                onClick={() => handleToggleActiveStatus(!activeStatusEnabled)}
              >
                <span className="sidebar__toggle-knob" />
              </button>
            </div>
            <p className="sidebar__active-status-info">{t('settings.activeStatusInfo')}</p>
          </div>
        </div>
      )}

      {/* Notifications sub-panel */}
      {showNotifications && showSettings && (
        <div className="sidebar__a11y-panel" ref={notifPanelRef} style={notifPanelStyle}>
          <div className="sidebar__settings-header">
            <button className="sidebar__a11y-back" onClick={() => setShowNotifications(false)}>
              <ChevronLeft size={16} />
            </button>
            <span>{t('settings.notifSoundTitle')}</span>
          </div>
          <div className="sidebar__settings-divider" />

          <div className="sidebar__a11y-section">
            <div className="sidebar__active-status-toggle">
              <span className="sidebar__active-status-label">{t('settings.notifSoundEnable')}</span>
              <button
                className={`sidebar__toggle-switch ${soundEnabled ? 'sidebar__toggle-switch--on' : ''}`}
                onClick={() => setSoundEnabled(!soundEnabled)}
              >
                <span className="sidebar__toggle-knob" />
              </button>
            </div>
          </div>

          <div className="sidebar__settings-divider" />

          <div className="sidebar__a11y-section">
            <div className="sidebar__a11y-label">
              <Volume2 size={15} />
              <span>{t('settings.notifSoundSelect')}</span>
            </div>
            <div className="sidebar__a11y-font-list">
              {SOUND_OPTIONS.map((opt) => {
                const labelKey = {
                  none: 'settings.notifSoundNone',
                  pop1: 'settings.notifSoundPop1',
                  pop2: 'settings.notifSoundPop2',
                  pop3: 'settings.notifSoundPop3',
                }[opt.value]
                return (
                  <div key={opt.value} className="sidebar__notif-sound-row">
                    <button
                      className={`sidebar__a11y-font-item ${selectedSound === opt.value ? 'sidebar__a11y-font-item--active' : ''}`}
                      onClick={() => setSelectedSound(opt.value)}
                      style={{ flex: 1 }}
                    >
                      {t(labelKey)}
                    </button>
                    {opt.value !== 'none' && (
                      <button
                        className="sidebar__notif-preview-btn"
                        onClick={() => previewSound(opt.value)}
                        title={t('settings.notifSoundPreview')}
                      >
                        <Play size={14} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Search User Modal */}
      <SearchUserModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onConversationCreated={handleConversationCreated}
      />
      
      {/* Create Group Modal */}
      <CreateGroupModal 
        isOpen={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onGroupCreated={handleConversationCreated}
      />

      <ConfirmModal 
        isOpen={confirmModalData.isOpen}
        title={
          confirmModalData.type === 'deleteChat' ? t('chat2.deleteChat') :
          confirmModalData.type === 'block' ? (t('chat.blockUser') || 'Chặn người dùng') : 
          (t('chat.unblockUser') || 'Bỏ chặn người dùng')
        }
        message={
          confirmModalData.type === 'deleteChat' ? t('chat2.deleteChatConfirm') :
          confirmModalData.type === 'block' ? (t('chat.blockUserConfirm') || 'Bạn có chắc chắn muốn chặn người dùng này?') : 
          (t('chat.unblockUserConfirm') || 'Bạn có chắc chắn muốn bỏ chặn người dùng này?')
        }
        danger={confirmModalData.type === 'block' || confirmModalData.type === 'deleteChat'}
        onConfirm={confirmAction}
        onCancel={() => setConfirmModalData(prev => ({ ...prev, isOpen: false }))}
      />
    </aside>
  )
})

export default Sidebar
