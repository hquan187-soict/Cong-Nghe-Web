import { useState, useEffect, useCallback } from 'react'
import { Search, X, UserPlus } from 'lucide-react'
import { useDebounce } from '../../hooks/useDebounce'
import { userService } from '../../services/user.service'
import { conversationService } from '../../services/conversation.service'
import { useToast } from '../../context/ToastContext'
import { useLang } from '../../context/LangContext'
import Avatar from '../ui/Avatar'

/**
 * SearchUserModal — Modal tìm kiếm user để tạo conversation mới
 * Props:
 *   - isOpen: boolean
 *   - onClose: callback đóng modal
 *   - onConversationCreated: callback(conversation) sau khi tạo thành công
 */
function SearchUserModal({ isOpen, onClose, onConversationCreated }) {
  const { t } = useLang()
  const toast = useToast()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // Debounce search query 300ms
  const debouncedQuery = useDebounce(query, 300)

  // Gọi API search khi debouncedQuery thay đổi
  useEffect(() => {
    if (!isOpen) return

    if (!debouncedQuery || debouncedQuery.trim().length < 2) {
      setResults([])
      return
    }

    let cancelled = false

    async function doSearch() {
      setIsSearching(true)
      try {
        const data = await userService.searchUsers(debouncedQuery.trim())
        if (!cancelled) {
          setResults(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Search error:', err)
          setResults([])
        }
      } finally {
        if (!cancelled) setIsSearching(false)
      }
    }

    doSearch()
    return () => { cancelled = true }
  }, [debouncedQuery, isOpen])

  // Đóng modal bằng Escape
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  // Reset state khi đóng modal
  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setResults([])
      setIsSearching(false)
      setIsCreating(false)
    }
  }, [isOpen])

  // Click user → tạo conversation
  const handleSelectUser = useCallback(async (userId) => {
    if (isCreating) return
    setIsCreating(true)

    try {
      const conversation = await conversationService.createConversation(userId)
      toast.success(t('chat.conversationCreated'))
      onConversationCreated(conversation)
      onClose()
    } catch (err) {
      console.error('Create conversation error:', err)
      const message = err.response?.data?.message || t('chat.createError')
      toast.error(message)
    } finally {
      setIsCreating(false)
    }
  }, [isCreating, onConversationCreated, onClose, toast, t])

  if (!isOpen) return null

  return (
    <div className="search-modal__overlay" onClick={onClose}>
      <div
        className="search-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="search-modal__header">
          <h3 className="search-modal__title">
            <UserPlus size={20} />
            {t('chat.newConversation')}
          </h3>
          <button
            className="search-modal__close"
            onClick={onClose}
            title={t('chat.close')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Search Input */}
        <div className="search-modal__input-wrapper">
          <Search size={18} className="search-modal__input-icon" />
          <input
            type="text"
            className="search-modal__input"
            placeholder={t('chat.searchUser')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <button
              className="search-modal__input-clear"
              onClick={() => setQuery('')}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="search-modal__results">
          {/* Chưa nhập đủ ký tự */}
          {(!debouncedQuery || debouncedQuery.trim().length < 2) && !isSearching && (
            <p className="search-modal__hint">
              {t('chat.searchMinChars')}
            </p>
          )}

          {/* Đang tìm kiếm */}
          {isSearching && (
            <div className="search-modal__loading">
              <div className="search-modal__spinner"></div>
              <span>{t('chat.searching')}</span>
            </div>
          )}

          {/* Không tìm thấy */}
          {!isSearching && debouncedQuery && debouncedQuery.trim().length >= 2 && results.length === 0 && (
            <p className="search-modal__empty">
              {t('chat.noResults')}
            </p>
          )}

          {/* Danh sách kết quả */}
          {!isSearching && results.map((u) => (
            <div
              key={u._id}
              className="search-modal__user"
              onClick={() => handleSelectUser(u._id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSelectUser(u._id) }}
            >
              <Avatar
                src={u.avatar}
                alt={u.fullName || '?'}
                size="sm"
              />
              <div className="search-modal__user-info">
                <span className="search-modal__user-name">
                  {u.fullName}
                </span>
                <span className="search-modal__user-email">
                  {u.email}
                </span>
              </div>
              {isCreating && (
                <div className="search-modal__creating-badge">
                  {t('chat.creating')}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SearchUserModal
