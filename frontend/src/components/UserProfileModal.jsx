import { useState, useEffect, useRef } from 'react'
import { X, MessageSquare, UserPlus, UserMinus, Clock, ShieldBan, ShieldCheck, Mail, User, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { useToast } from '../context/ToastContext'
import { useLang } from '../context/LangContext'
import { userService } from '../services/user.service'
import { formatLastActive } from '../utils/timeUtils'
import Avatar from './ui/Avatar'

function UserProfileModal({ isOpen, onClose, userId, onSendMessage }) {
  const { user: currentUser, updateUser } = useAuth()
  const { onlineUsers } = useSocket()
  const toast = useToast()
  const { t, lang } = useLang()

  const [profileUser, setProfileUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  const [relationshipStatus, setRelationshipStatus] = useState('none')
  const [isBlocked, setIsBlocked] = useState(false)

  const fetchIdRef = useRef(0)

  useEffect(() => {
    if (!isOpen || !userId || userId === currentUser?._id) {
      setProfileUser(null)
      setError(null)
      return
    }

    const fetchId = ++fetchIdRef.current
    setLoading(true)
    setError(null)
    setProfileUser(null)

    userService.getUserById(userId)
      .then((data) => {
        if (fetchId !== fetchIdRef.current) return
        setProfileUser(data)
        computeRelationship(data)
      })
      .catch((err) => {
        if (fetchId !== fetchIdRef.current) return
        setError(err.response?.data?.message || t('userProfile.error'))
      })
      .finally(() => {
        if (fetchId !== fetchIdRef.current) return
        setLoading(false)
      })
  }, [isOpen, userId])

  useEffect(() => {
    if (currentUser && userId) {
      const blocked = currentUser.blockedUsers?.some(
        id => (id?._id || id)?.toString() === userId
      )
      setIsBlocked(!!blocked)
    }
  }, [currentUser, userId])

  function computeRelationship(fetchedUser) {
    if (!currentUser || !fetchedUser) return

    const isFriend = currentUser.friends?.some(
      f => (f?._id || f)?.toString() === fetchedUser._id
    )
    if (isFriend) {
      setRelationshipStatus('friends')
      return
    }

    const sentRequest = currentUser.friendRequests?.some(
      r => {
        const toId = r?.to?._id || r?.to
        return toId?.toString() === fetchedUser._id && r?.status === 'pending'
      }
    )
    if (sentRequest) {
      setRelationshipStatus('request_sent')
      return
    }

    const receivedRequest = currentUser.friendRequests?.some(
      r => {
        const fromId = r?.from?._id || r?.from
        return fromId?.toString() === fetchedUser._id && r?.status === 'pending'
      }
    )
    if (receivedRequest) {
      setRelationshipStatus('request_received')
      return
    }

    const friendsOfUser = fetchedUser.friends || []
    const isFriendAlt = friendsOfUser.some(
      f => (f?._id || f)?.toString() === currentUser._id
    )
    if (isFriendAlt) {
      setRelationshipStatus('friends')
      return
    }

    const reqsOfUser = fetchedUser.friendRequests || []
    const sentAlt = reqsOfUser.some(r => {
      const fromId = r?.from?._id || r?.from
      return fromId?.toString() === currentUser._id && r?.status === 'pending'
    })
    if (sentAlt) {
      setRelationshipStatus('request_sent')
      return
    }

    const receivedAlt = reqsOfUser.some(r => {
      const toId = r?.to?._id || r?.to
      return toId?.toString() === currentUser._id && r?.status === 'pending'
    })
    if (receivedAlt) {
      setRelationshipStatus('request_received')
      return
    }

    setRelationshipStatus('none')
  }

  useEffect(() => {
    if (profileUser && currentUser) {
      computeRelationship(profileUser)
    }
  }, [currentUser])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !userId || userId === currentUser?._id) return null

  const isOnline = onlineUsers.some(id => id.toString() === userId)

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  async function handleSendFriendRequest() {
    setActionLoading(true)
    try {
      const result = await userService.sendFriendRequest(userId)
      if (result?.autoAccepted) {
        setRelationshipStatus('friends')
        toast.success(t('userProfile.friendRequestAutoAccepted'))
      } else {
        setRelationshipStatus('request_sent')
        toast.success(t('userProfile.friendRequestSuccess'))
      }
      const updatedMe = await userService.getUserById(currentUser._id).catch(() => null)
      if (updatedMe) updateUser(updatedMe)
    } catch (err) {
      toast.error(err.response?.data?.message || t('contacts.acceptError'))
    } finally {
      setActionLoading(false)
    }
  }

  async function handleAcceptFriendRequest() {
    setActionLoading(true)
    try {
      await userService.acceptFriendRequest(userId)
      setRelationshipStatus('friends')
      toast.success(t('userProfile.acceptSuccess'))
      const updatedMe = await userService.getUserById(currentUser._id).catch(() => null)
      if (updatedMe) updateUser(updatedMe)
    } catch (err) {
      toast.error(err.response?.data?.message || t('contacts.acceptError'))
    } finally {
      setActionLoading(false)
    }
  }

  async function handleUnfriend() {
    setActionLoading(true)
    try {
      await userService.unfriend(userId)
      setRelationshipStatus('none')
      toast.success(t('userProfile.unfriendSuccess'))
      const updatedMe = await userService.getUserById(currentUser._id).catch(() => null)
      if (updatedMe) updateUser(updatedMe)
    } catch (err) {
      toast.error(err.response?.data?.message || t('contacts.unfriendError'))
    } finally {
      setActionLoading(false)
    }
  }

  async function handleBlock() {
    if (!window.confirm(t('userProfile.blockConfirm'))) return
    setActionLoading(true)
    try {
      const updatedMe = await userService.blockUser(userId)
      if (updatedMe) updateUser(updatedMe)
      setIsBlocked(true)
      toast.success(t('userProfile.blockSuccess'))
    } catch (err) {
      toast.error(err.response?.data?.message || t('chat.blockUser'))
    } finally {
      setActionLoading(false)
    }
  }

  async function handleUnblock() {
    if (!window.confirm(t('userProfile.unblockConfirm'))) return
    setActionLoading(true)
    try {
      const updatedMe = await userService.unblockUser(userId)
      if (updatedMe) updateUser(updatedMe)
      setIsBlocked(false)
      toast.success(t('userProfile.unblockSuccess'))
    } catch (err) {
      toast.error(err.response?.data?.message || t('chat.unblockUser'))
    } finally {
      setActionLoading(false)
    }
  }

  function handleSendMessage() {
    if (onSendMessage) {
      onSendMessage(userId)
    }
    onClose()
  }

  const renderSkeleton = () => (
    <div className="user-profile-modal">
      <button className="profile-modal__close-btn" onClick={onClose}><X size={20} /></button>
      <div className="profile-modal__banner"><div className="profile-modal__banner-pattern" /></div>
      <div className="profile-modal__avatar-wrapper">
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--color-hover-bg)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
      <div className="profile-modal__body">
        <div style={{ height: 22, width: '60%', margin: '0 auto 8px', background: 'var(--color-hover-bg)', borderRadius: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ height: 14, width: '40%', margin: '0 auto', background: 'var(--color-hover-bg)', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
      </div>
    </div>
  )

  const renderError = () => (
    <div className="user-profile-modal">
      <button className="profile-modal__close-btn" onClick={onClose}><X size={20} /></button>
      <div className="profile-modal__banner"><div className="profile-modal__banner-pattern" /></div>
      <div className="profile-modal__body" style={{ textAlign: 'center', padding: '40px 28px' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>{error}</p>
      </div>
    </div>
  )

  const renderFriendButton = () => {
    if (isBlocked) return null

    switch (relationshipStatus) {
      case 'friends':
        return (
          <button
            className="user-profile-modal__action-btn user-profile-modal__action-btn--danger"
            onClick={handleUnfriend}
            disabled={actionLoading}
          >
            {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <UserMinus size={16} />}
            {t('userProfile.unfriend')}
          </button>
        )
      case 'request_sent':
        return (
          <button
            className="user-profile-modal__action-btn user-profile-modal__action-btn--secondary"
            disabled
          >
            <Clock size={16} />
            {t('userProfile.requestSent')}
          </button>
        )
      case 'request_received':
        return (
          <button
            className="user-profile-modal__action-btn user-profile-modal__action-btn--success"
            onClick={handleAcceptFriendRequest}
            disabled={actionLoading}
          >
            {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            {t('userProfile.acceptRequest')}
          </button>
        )
      default:
        return (
          <button
            className="user-profile-modal__action-btn user-profile-modal__action-btn--secondary"
            onClick={handleSendFriendRequest}
            disabled={actionLoading}
          >
            {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            {t('userProfile.addFriend')}
          </button>
        )
    }
  }

  return (
    <div className="profile-modal__overlay" onClick={handleOverlayClick}>
      {loading ? renderSkeleton() : error ? renderError() : profileUser && (
        <div className="user-profile-modal">
          <button className="profile-modal__close-btn" onClick={onClose}>
            <X size={20} />
          </button>

          <div className="profile-modal__banner">
            <div className="profile-modal__banner-pattern" />
          </div>

          <div className="profile-modal__avatar-wrapper">
            <Avatar
              src={profileUser.avatar}
              alt={profileUser.fullName || '?'}
              size="lg"
              isOnline={isOnline}
            />
          </div>

          <div className="profile-modal__body">
            <h2 className="profile-modal__name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profileUser.fullName || t('profile.defaultName')}
            </h2>

            <p className="profile-modal__subtitle">
              {isOnline
                ? t('userProfile.online')
                : profileUser.lastSeen
                  ? formatLastActive(profileUser.lastSeen, lang)
                  : t('userProfile.offline')}
            </p>

            <div className="profile-modal__info-list">
              <div className="profile-modal__info-item">
                <div className="profile-modal__info-icon profile-modal__info-icon--indigo">
                  <User size={18} />
                </div>
                <div className="profile-modal__info-content">
                  <span className="profile-modal__info-label">{t('profile.fullName')}</span>
                  <span className="profile-modal__info-value">{profileUser.fullName || '—'}</span>
                </div>
              </div>

              <div className="profile-modal__info-item">
                <div className="profile-modal__info-icon profile-modal__info-icon--purple">
                  <Mail size={18} />
                </div>
                <div className="profile-modal__info-content">
                  <span className="profile-modal__info-label">{t('profile.email')}</span>
                  <span className="profile-modal__info-value profile-modal__info-value--truncate">{profileUser.email || '—'}</span>
                </div>
              </div>
            </div>

            <div className="user-profile-modal__actions">
              <button
                className="user-profile-modal__action-btn user-profile-modal__action-btn--primary"
                onClick={handleSendMessage}
              >
                <MessageSquare size={16} />
                {t('userProfile.sendMessage')}
              </button>

              {renderFriendButton()}

              {isBlocked ? (
                <button
                  className="user-profile-modal__action-btn user-profile-modal__action-btn--danger"
                  onClick={handleUnblock}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  {t('userProfile.unblock')}
                </button>
              ) : (
                <button
                  className="user-profile-modal__action-btn user-profile-modal__action-btn--ghost"
                  onClick={handleBlock}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <ShieldBan size={16} />}
                  {t('userProfile.block')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserProfileModal
