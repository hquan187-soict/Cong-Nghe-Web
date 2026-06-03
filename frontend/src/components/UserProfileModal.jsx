import { useState, useEffect, useRef } from 'react'
import { X, MessageSquare, UserPlus, UserMinus, Clock, ShieldBan, ShieldCheck, Mail, User, Loader2, Cake, MapPin, Heart, Briefcase, GraduationCap, Phone } from 'lucide-react'
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
        if (data.relationshipStatus) {
          setRelationshipStatus(data.relationshipStatus)
        } else {
          setRelationshipStatus('none')
        }
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

  function formatBirthday(dateStr) {
    if (!dateStr) return null
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    return d.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  function getGenderLabel(g) {
    if (g === 'male') return t('profile.genderMale')
    if (g === 'female') return t('profile.genderFemale')
    if (g === 'other') return t('profile.genderOther')
    return null
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

  const renderExtendedInfo = () => {
    if (!profileUser) return null
    const infoItems = []

    if (profileUser.bio) {
      infoItems.push({ icon: <User size={16} />, label: t('profile.bio'), value: profileUser.bio, cls: 'indigo' })
    }
    if (profileUser.birthday) {
      infoItems.push({ icon: <Cake size={16} />, label: t('profile.birthday'), value: formatBirthday(profileUser.birthday), cls: 'purple' })
    }
    const gLabel = getGenderLabel(profileUser.gender)
    if (gLabel) {
      infoItems.push({ icon: <User size={16} />, label: t('profile.gender'), value: gLabel, cls: 'indigo' })
    }
    if (profileUser.phone) {
      infoItems.push({ icon: <Phone size={16} />, label: t('profile.phone'), value: profileUser.phone, cls: 'emerald' })
    }
    if (profileUser.address) {
      infoItems.push({ icon: <MapPin size={16} />, label: t('profile.address'), value: profileUser.address, cls: 'purple' })
    }
    if (profileUser.hometown) {
      infoItems.push({ icon: <MapPin size={16} />, label: t('profile.hometown'), value: profileUser.hometown, cls: 'indigo' })
    }
    if (profileUser.occupation) {
      infoItems.push({ icon: <Briefcase size={16} />, label: t('profile.occupation'), value: profileUser.occupation, cls: 'emerald' })
    }
    if (profileUser.education) {
      infoItems.push({ icon: <GraduationCap size={16} />, label: t('profile.education'), value: profileUser.education, cls: 'purple' })
    }
    if (profileUser.hobbies) {
      infoItems.push({ icon: <Heart size={16} />, label: t('profile.hobbies'), value: profileUser.hobbies, cls: 'indigo' })
    }

    if (infoItems.length === 0) return null

    return (
      <div className="profile-modal__info-list" style={{ marginTop: 12 }}>
        {infoItems.map((item, idx) => (
          <div key={idx} className="profile-modal__info-item" style={{ padding: '10px 14px', gap: 10 }}>
            <div className={`profile-modal__info-icon profile-modal__info-icon--${item.cls}`} style={{ width: 32, height: 32, borderRadius: 8 }}>
              {item.icon}
            </div>
            <div className="profile-modal__info-content">
              <span className="profile-modal__info-label">{item.label}</span>
              <span className="profile-modal__info-value" style={{ fontSize: 13, wordBreak: 'break-word' }}>{item.value}</span>
            </div>
          </div>
        ))}
      </div>
    )
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
                <div className="profile-modal__info-icon profile-modal__info-icon--purple">
                  <Mail size={18} />
                </div>
                <div className="profile-modal__info-content">
                  <span className="profile-modal__info-label">{t('profile.email')}</span>
                  <span className="profile-modal__info-value profile-modal__info-value--truncate">{profileUser.email || '—'}</span>
                </div>
              </div>
            </div>

            {renderExtendedInfo()}

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
