import { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef, useLayoutEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, User, Sun, Moon, Search, Settings, ChevronsLeft, ChevronsRight, Languages, Bell, Eye, Accessibility, HardDrive, HelpCircle, ChevronRight, ChevronLeft, Type, ALargeSmall, MessageSquare, Users, UserPlus, Archive } from 'lucide-react'
import { conversationService } from '../../services/conversation.service'
import { messageService } from '../../services/message.service'
import { useLang } from '../../context/LangContext'
import { useTheme } from '../../context/ThemeContext'
import { useToast } from '../../context/ToastContext'
import { useAccessibility } from '../../context/AccessibilityContext'
import { useSocket } from '../../context/SocketContext'
import { useAuth } from '../../context/AuthContext'
import { userService } from '../../services/user.service'
import ConversationItem from './ConversationItem'
import SearchUserModal from './SearchUserModal'
import CreateGroupModal from './CreateGroupModal'
import '../../styles/sidebar.css'

const Sidebar = forwardRef(function Sidebar({ selectedConversation, onSelectConversation, collapsed, onToggleCollapse, onlineUsers = [] }, ref) {
  const { t, lang, toggleLang } = useLang()
  const { theme, toggleTheme } = useTheme()
  const toast = useToast()
  const navigate = useNavigate()
  const { fontSize, setFontSize, fontFamily, setFontFamily, FONT_SIZES, FONT_FAMILIES } = useAccessibility()
  const { socket } = useSocket()
  const { user, updateUser } = useAuth()

  const [conversations, setConversations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  
  const [showSettings, setShowSettings] = useState(false)
  const [showAccessibility, setShowAccessibility] = useState(false)
  const [showActiveStatus, setShowActiveStatus] = useState(false)
  const [activeStatusEnabled, setActiveStatusEnabled] = useState(() => {
    const saved = localStorage.getItem('active_status_enabled')
    return saved !== null ? saved === 'true' : true
  })
  
  const settingsRef = useRef(null)
  const settingsBtnRef = useRef(null)
  const dropdownRef = useRef(null)
  const a11yPanelRef = useRef(null)
  const activeStatusPanelRef = useRef(null)
  const activeStatusBtnRef = useRef(null)
  const [dropdownStyle, setDropdownStyle] = useState({})
  const [a11yPanelStyle, setA11yPanelStyle] = useState({})
  const [activeStatusPanelStyle, setActiveStatusPanelStyle] = useState({})

  const [unreadMap, setUnreadMap] = useState({})
  const [pinMap, setPinMap] = useState({})
  const [muteMap, setMuteMap] = useState({})
  const [activeFilter, setActiveFilter] = useState('all') // 'all' | 'unread' | 'archived'

  useImperativeHandle(ref, () => ({
    updateLastMessage(conversationId, lastMessage) {
      setConversations((prev) => {
        const updated = prev.map((conv) =>
          conv._id === conversationId
            ? {
                ...conv,
                lastMessage,
                updatedAt: lastMessage.createdAt || new Date().toISOString(),
              }
            : conv
        )
        // Note: we don't need to sort here because useMemo handles the view sorting
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
  }), [])

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
            if (conv.unreadCount && conv.unreadCount > 0) {
              uMap[conv._id] = conv.unreadCount
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

    socket.on('newConversation', handleNewConversation)
    socket.on('conversationUpdated', handleConversationUpdated)

    return () => {
      socket.off('newConversation', handleNewConversation)
      socket.off('conversationUpdated', handleConversationUpdated)
    }
  }, [socket])

  const handleSelectConversation = useCallback(async (conv) => {
    onSelectConversation(conv)
    setUnreadMap((prev) => {
      if (!prev[conv._id]) return prev
      const next = { ...prev }
      delete next[conv._id]
      return next
    })
    if (!conv._id.startsWith('mock_') && !conv._id.startsWith('conv_')) {
      try {
        await messageService.markAsRead(conv._id)
      } catch (err) {
        console.error('Mark as read error:', err)
      }
    }
  }, [onSelectConversation])

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

  const handlePin = useCallback((convId) => {
    setPinMap(prev => ({ ...prev, [convId]: !prev[convId] }))
  }, [])

  const handleMute = useCallback((convId) => {
    setMuteMap(prev => ({ ...prev, [convId]: !prev[convId] }))
  }, [])

  const handleArchive = useCallback(async (convId) => {
    try {
      const updatedConv = await conversationService.toggleArchiveConversation(convId)
      setConversations(prev =>
        prev.map(c => c._id === convId ? { ...c, ...updatedConv } : c)
      )
      const isNowArchived = updatedConv.archivedBy?.some(
        id => (id._id || id).toString() === user?._id?.toString()
      )
      toast.success(isNowArchived ? 'Đã lưu trữ cuộc trò chuyện' : 'Đã bỏ lưu trữ cuộc trò chuyện')
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
      if (selectedConversation?._id === convId) {
        onSelectConversation(null)
      }
      toast.success(t('chat.leftGroup') || 'Đã rời nhóm thành công!')
    } catch (err) {
      console.error('Leave group error:', err)
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi rời nhóm.')
    }
  }, [selectedConversation, onSelectConversation, t, toast])

  useEffect(() => {
    function handleClickOutside(e) {
      const clickedInSettings = settingsRef.current?.contains(e.target)
      const clickedInDropdown = dropdownRef.current?.contains(e.target)
      const clickedInA11y = a11yPanelRef.current?.contains(e.target)
      const clickedInActiveStatus = activeStatusPanelRef.current?.contains(e.target)
      if (!clickedInSettings && !clickedInDropdown && !clickedInA11y && !clickedInActiveStatus) {
        setShowSettings(false)
        setShowAccessibility(false)
        setShowActiveStatus(false)
      }
    }
    if (showSettings || showAccessibility || showActiveStatus) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSettings, showAccessibility, showActiveStatus])

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
    setA11yPanelStyle({
      left: rect.right + 8,
      bottom: window.innerHeight - rect.bottom,
    })
  }, [showAccessibility])

  useLayoutEffect(() => {
    if (!showActiveStatus || !dropdownRef.current) return
    const dropdownRect = dropdownRef.current.getBoundingClientRect()
    const btnRect = activeStatusBtnRef.current?.getBoundingClientRect()
    setActiveStatusPanelStyle({
      left: dropdownRect.right + 8,
      top: btnRect ? btnRect.top : dropdownRect.top,
    })
  }, [showActiveStatus])

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
        <div className="sidebar-nav-vertical" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 0', borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-surface)', width: '100%', alignItems: 'center' }}>
          <button 
            className="sidebar-nav__tab-vertical sidebar-nav__tab-vertical--active" 
            style={{ width: '40px', height: '40px', background: 'var(--color-primary-light)', border: 'none', borderRadius: '50%', color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={t('chat.title')}
          >
            <MessageSquare size={20} />
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
        <div className="sidebar-nav" style={{ display: 'flex', borderBottom: '1px solid var(--color-border-subtle)', background: 'var(--color-surface)' }}>
          <button 
            className="sidebar-nav__tab sidebar-nav__tab--active" 
            style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', borderBottom: '2px solid var(--color-primary)', color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}
          >
            <MessageSquare size={18} /> {t('chat.title')}
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

      {/* Header */}
      <div className="sidebar__header" style={collapsed ? {} : { paddingBottom: '8px' }}>
        <div className="sidebar__header-left">
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
          {!collapsed && (
            <h2 className="sidebar__title">
              {t('chat.conversations')}
            </h2>
          )}
        </div>
        {!collapsed && (
          <div className="sidebar__header-right" style={{ display: 'flex', gap: '4px' }}>
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

      {/* Search bar & Filters */}
      {!collapsed && (
        <>
          <div className="sidebar__search" style={{ paddingBottom: '8px' }}>
            <div className="sidebar__search-bar" onClick={handleSearchBarClick}>
              <Search size={16} className="sidebar__search-icon" />
              <span className="sidebar__search-placeholder">
                {t('chat.searchPlaceholder')}
              </span>
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
                Lưu trữ ({archivedCount})
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
          />
        ))}
      </div>

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
            <button
              className="sidebar__footer-btn tooltip-wrapper"
              onClick={onToggleCollapse}
            >
              <ChevronsRight size={20} />
              <span className="tooltip tooltip--right">{t('chat.expandSidebar')}</span>
            </button>
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
            <button
              className="sidebar__footer-btn tooltip-wrapper"
              onClick={onToggleCollapse}
            >
              <ChevronsLeft size={20} />
              <span className="tooltip tooltip--top">{t('chat.collapseSidebar')}</span>
            </button>
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
          <button className="sidebar__settings-item">
            <Bell size={16} />
            <div className="sidebar__settings-item-text">
              <span>{t('settings.notifications')}</span>
              <span className="sidebar__settings-desc">{t('settings.notificationsDesc')}</span>
            </div>
            <ChevronRight size={14} className="sidebar__settings-arrow" />
          </button>
          <button ref={activeStatusBtnRef} className="sidebar__settings-item" onClick={() => { setShowActiveStatus(true); setShowAccessibility(false) }}>
            <Eye size={16} />
            <div className="sidebar__settings-item-text">
              <span>{t('settings.activeStatus')}</span>
              <span className="sidebar__settings-desc">{t('settings.activeStatusDesc')}</span>
            </div>
            <ChevronRight size={14} className="sidebar__settings-arrow" />
          </button>
          <button className="sidebar__settings-item" onClick={() => { setShowAccessibility(true); setShowActiveStatus(false) }}>
            <Accessibility size={16} />
            <div className="sidebar__settings-item-text">
              <span>{t('settings.accessibility')}</span>
              <span className="sidebar__settings-desc">{t('settings.accessibilityDesc')}</span>
            </div>
            <ChevronRight size={14} className="sidebar__settings-arrow" />
          </button>
          <button className="sidebar__settings-item">
            <HardDrive size={16} />
            <div className="sidebar__settings-item-text">
              <span>{t('settings.storage')}</span>
              <span className="sidebar__settings-desc">{t('settings.storageDesc')}</span>
            </div>
            <ChevronRight size={14} className="sidebar__settings-arrow" />
          </button>
          <div className="sidebar__settings-divider" />
          <button className="sidebar__settings-item">
            <HelpCircle size={16} />
            <div className="sidebar__settings-item-text">
              <span>{t('settings.helpSupport')}</span>
              <span className="sidebar__settings-desc">{t('settings.helpSupportDesc')}</span>
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
    </aside>
  )
})

export default Sidebar
