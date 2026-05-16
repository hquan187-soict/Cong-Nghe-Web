import { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef, useLayoutEffect } from 'react'
import { MessageCircle, User, Sun, Moon, Search, Settings, ChevronsLeft, ChevronsRight, Languages, Bell, Eye, Accessibility, HardDrive, HelpCircle, ChevronRight } from 'lucide-react'
import { conversationService } from '../../services/conversation.service'
import { messageService } from '../../services/message.service'
import { useLang } from '../../context/LangContext'
import { useTheme } from '../../context/ThemeContext'
import { useToast } from '../../context/ToastContext'
import ConversationItem from './ConversationItem'
import SearchUserModal from './SearchUserModal'
import '../../styles/sidebar.css'

const Sidebar = forwardRef(function Sidebar({ selectedConversation, onSelectConversation, collapsed, onToggleCollapse, onOpenProfile }, ref) {
  const { t, lang, toggleLang } = useLang()
  const { theme, toggleTheme } = useTheme()
  const toast = useToast()

  const [conversations, setConversations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const settingsRef = useRef(null)
  const settingsBtnRef = useRef(null)
  const dropdownRef = useRef(null)
  const [dropdownStyle, setDropdownStyle] = useState({})

  const [unreadMap, setUnreadMap] = useState({})

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
        updated.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
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
  }), [])

  useEffect(() => {
    let cancelled = false

    const MOCK_NOW = new Date()
    const ago = (minutes) => new Date(MOCK_NOW - minutes * 60 * 1000).toISOString()
    const MOCK_CONVERSATIONS = [
      {
        _id: 'mock_conv_001',
        members: [
          { _id: 'mock_user_001', fullName: 'Bạn', avatar: null },
          { _id: 'mock_user_alice', fullName: 'Alice Nguyễn', avatar: null },
        ],
        lastMessage: { text: 'Oke bạn nhé! Hẹn gặp lại 😊', createdAt: ago(2) },
        updatedAt: ago(2),
      },
      {
        _id: 'mock_conv_002',
        members: [
          { _id: 'mock_user_001', fullName: 'Bạn', avatar: null },
          { _id: 'mock_user_bob', fullName: 'Bob Trần', avatar: null },
        ],
        lastMessage: { text: 'Lorem ipsum dolor sit amet consectetur...', createdAt: ago(15) },
        updatedAt: ago(15),
      },
      {
        _id: 'mock_conv_003',
        members: [
          { _id: 'mock_user_001', fullName: 'Bạn', avatar: null },
          { _id: 'mock_user_charlie', fullName: 'Charlie Lê', avatar: null },
        ],
        lastMessage: { text: 'OK', createdAt: ago(60) },
        updatedAt: ago(60),
      },
      {
        _id: 'mock_conv_004',
        members: [
          { _id: 'mock_user_001', fullName: 'Bạn', avatar: null },
          { _id: 'mock_user_diana', fullName: 'Diana Phạm', avatar: null },
        ],
        lastMessage: { text: 'Cảm ơn bạn nhiều lắm!', createdAt: ago(120) },
        updatedAt: ago(120),
      },
    ]

    const MOCK_UNREAD_MAP = {
      mock_conv_001: 3,
      mock_conv_002: 12,
      mock_conv_003: 0,
      mock_conv_004: 1,
    }

    async function fetchConversations() {
      setIsLoading(true)
      try {
        const data = await conversationService.getConversations()
        if (!cancelled) {
          const list = Array.isArray(data) ? data : []
          if (list.length === 0 && import.meta.env.DEV) {
            setConversations(MOCK_CONVERSATIONS)
            setUnreadMap(MOCK_UNREAD_MAP)
          } else {
            setConversations(list)
            const uMap = {}
            list.forEach((conv) => {
              if (conv.unreadCount && conv.unreadCount > 0) {
                uMap[conv._id] = conv.unreadCount
              }
            })
            setUnreadMap(uMap)
          }
        }
      } catch (err) {
        console.error('Fetch conversations error:', err)
        if (!cancelled && import.meta.env.DEV) {
          setConversations(MOCK_CONVERSATIONS)
          setUnreadMap(MOCK_UNREAD_MAP)
        } else if (!cancelled) {
          toast.error(t('chat.loadError'))
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchConversations()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectConversation = useCallback(async (conv) => {
    onSelectConversation(conv)
    setUnreadMap((prev) => {
      if (!prev[conv._id]) return prev
      const next = { ...prev }
      delete next[conv._id]
      return next
    })
    if (!conv._id.startsWith('mock_')) {
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
    onSelectConversation(newConversation)
  }, [onSelectConversation])

  useEffect(() => {
    function handleClickOutside(e) {
      if (settingsRef.current && !settingsRef.current.contains(e.target) &&
          dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowSettings(false)
      }
    }
    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSettings])

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

  const handleSearchBarClick = () => {
    setShowSearchModal(true)
  }

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      {/* Header */}
      <div className="sidebar__header">
        <div className="sidebar__header-left">
          <button
            className="sidebar__profile-btn"
            title={t('profile.title')}
            onClick={() => onOpenProfile?.()}
          >
            <User size={18} />
          </button>
          {!collapsed && (
            <h2 className="sidebar__title">
              <MessageCircle size={18} />
              {t('chat.conversations')}
            </h2>
          )}
        </div>
      </div>

      {/* Search bar */}
      {!collapsed && (
        <div className="sidebar__search">
          <div className="sidebar__search-bar" onClick={handleSearchBarClick}>
            <Search size={16} className="sidebar__search-icon" />
            <span className="sidebar__search-placeholder">
              {t('chat.searchPlaceholder')}
            </span>
          </div>
        </div>
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

        {!isLoading && conversations.length === 0 && (
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

        {!isLoading && conversations.map((conv) => (
          <ConversationItem
            key={conv._id}
            conversation={conv}
            isActive={selectedConversation?._id === conv._id}
            onClick={() => handleSelectConversation(conv)}
            unreadCount={unreadMap[conv._id] || 0}
            collapsed={collapsed}
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
                onClick={() => setShowSettings((v) => !v)}
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
                onClick={() => setShowSettings((v) => !v)}
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
          <button className="sidebar__settings-item">
            <Eye size={16} />
            <div className="sidebar__settings-item-text">
              <span>{t('settings.activeStatus')}</span>
              <span className="sidebar__settings-desc">{t('settings.activeStatusDesc')}</span>
            </div>
            <ChevronRight size={14} className="sidebar__settings-arrow" />
          </button>
          <button className="sidebar__settings-item">
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

      {/* Search User Modal */}
      <SearchUserModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onConversationCreated={handleConversationCreated}
      />
    </aside>
  )
})

export default Sidebar
