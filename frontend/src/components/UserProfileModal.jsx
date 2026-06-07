import { useState, useEffect, useRef } from 'react'
import { X, MessageSquare, UserPlus, UserMinus, Clock, ShieldBan, ShieldCheck, Mail, User, Loader2, Cake, MapPin, Heart, Briefcase, GraduationCap, Phone, ChevronDown, ChevronUp, Flag } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { useToast } from '../context/ToastContext'
import { useLang } from '../context/LangContext'
import { userService } from '../services/user.service'
import { formatLastActive } from '../utils/timeUtils'
import Avatar from './ui/Avatar'
import ReportModal from './ReportModal'

const COVER_COLORS = {
  '': 'linear-gradient(135deg, #4f46e5, #7c3aed)',
  blue: 'linear-gradient(135deg, #2563eb, #0ea5e9)',
  cyan: 'linear-gradient(135deg, #0891b2, #06b6d4)',
  teal: 'linear-gradient(135deg, #0d9488, #14b8a6)',
  green: 'linear-gradient(135deg, #16a34a, #22c55e)',
  orange: 'linear-gradient(135deg, #ea580c, #f97316)',
  red: 'linear-gradient(135deg, #dc2626, #ef4444)',
  pink: 'linear-gradient(135deg, #db2777, #ec4899)',
  purple: 'linear-gradient(135deg, #7c3aed, #a855f7)',
  slate: 'linear-gradient(135deg, #475569, #64748b)',
  rose: 'linear-gradient(135deg, #e11d48, #f43f5e)',
  amber: 'linear-gradient(135deg, #d97706, #f59e0b)',
}

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
  const [showDetails, setShowDetails] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const fetchIdRef = useRef(0)

  useEffect(() => {
    if (!isOpen || !userId || userId === currentUser?._id) {
      setProfileUser(null); setError(null); setShowDetails(false); return
    }
    const fetchId = ++fetchIdRef.current
    setLoading(true); setError(null); setProfileUser(null); setShowDetails(false)
    userService.getUserById(userId)
      .then(data => {
        if (fetchId !== fetchIdRef.current) return
        setProfileUser(data)
        setRelationshipStatus(data.relationshipStatus || 'none')
      })
      .catch(err => {
        if (fetchId !== fetchIdRef.current) return
        setError(err.response?.data?.message || t('userProfile.error'))
      })
      .finally(() => { if (fetchId === fetchIdRef.current) setLoading(false) })
  }, [isOpen, userId])

  useEffect(() => {
    if (currentUser && userId) {
      setIsBlocked(!!currentUser.blockedUsers?.some(id => (id?._id || id)?.toString() === userId))
    }
  }, [currentUser, userId])

  useEffect(() => {
    if (!isOpen) return
    const h = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [isOpen, onClose])

  if (!isOpen || !userId || userId === currentUser?._id) return null

  const isOnline = onlineUsers.some(id => id.toString() === userId)

  async function handleSendFriendRequest() {
    setActionLoading(true)
    try {
      const result = await userService.sendFriendRequest(userId)
      if (result?.autoAccepted) { setRelationshipStatus('friends'); toast.success(t('userProfile.friendRequestAutoAccepted')) }
      else { setRelationshipStatus('request_sent'); toast.success(t('userProfile.friendRequestSuccess')) }
      const updatedMe = await userService.getUserById(currentUser._id).catch(() => null)
      if (updatedMe) updateUser(updatedMe)
    } catch (err) { toast.error(err.response?.data?.message || t('contacts.acceptError')) }
    finally { setActionLoading(false) }
  }

  async function handleAcceptFriendRequest() {
    setActionLoading(true)
    try {
      await userService.acceptFriendRequest(userId)
      setRelationshipStatus('friends'); toast.success(t('userProfile.acceptSuccess'))
      const updatedMe = await userService.getUserById(currentUser._id).catch(() => null)
      if (updatedMe) updateUser(updatedMe)
    } catch (err) { toast.error(err.response?.data?.message || t('contacts.acceptError')) }
    finally { setActionLoading(false) }
  }

  async function handleUnfriend() {
    setActionLoading(true)
    try {
      await userService.unfriend(userId)
      setRelationshipStatus('none'); toast.success(t('userProfile.unfriendSuccess'))
      const updatedMe = await userService.getUserById(currentUser._id).catch(() => null)
      if (updatedMe) updateUser(updatedMe)
    } catch (err) { toast.error(err.response?.data?.message || t('contacts.unfriendError')) }
    finally { setActionLoading(false) }
  }

  async function handleBlock() {
    if (!window.confirm(t('userProfile.blockConfirm'))) return
    setActionLoading(true)
    try {
      const updatedMe = await userService.blockUser(userId)
      if (updatedMe) updateUser(updatedMe)
      setIsBlocked(true); toast.success(t('userProfile.blockSuccess'))
    } catch (err) { toast.error(err.response?.data?.message || t('chat.blockUser')) }
    finally { setActionLoading(false) }
  }

  async function handleUnblock() {
    if (!window.confirm(t('userProfile.unblockConfirm'))) return
    setActionLoading(true)
    try {
      const updatedMe = await userService.unblockUser(userId)
      if (updatedMe) updateUser(updatedMe)
      setIsBlocked(false); toast.success(t('userProfile.unblockSuccess'))
    } catch (err) { toast.error(err.response?.data?.message || t('chat.unblockUser')) }
    finally { setActionLoading(false) }
  }

  function handleSendMessage() {
    if (onSendMessage) onSendMessage(userId)
    onClose()
  }

  function fmtBday(d) {
    if (!d) return null
    const dt = new Date(d)
    return isNaN(dt.getTime()) ? null : dt.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  function genderLabel(g) {
    return g === 'male' ? t('profile.genderMale') : g === 'female' ? t('profile.genderFemale') : g === 'other' ? t('profile.genderOther') : null
  }

  const coverGradient = COVER_COLORS[profileUser?.coverColor] || COVER_COLORS['']

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
    const btnCls = 'user-profile-modal__action-btn'
    switch (relationshipStatus) {
      case 'friends': return (
        <button className={`${btnCls} ${btnCls}--danger`} onClick={handleUnfriend} disabled={actionLoading}>
          {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <UserMinus size={16} />} {t('userProfile.unfriend')}
        </button>)
      case 'request_sent': return (
        <button className={`${btnCls} ${btnCls}--secondary`} disabled><Clock size={16} /> {t('userProfile.requestSent')}</button>)
      case 'request_received': return (
        <button className={`${btnCls} ${btnCls}--success`} onClick={handleAcceptFriendRequest} disabled={actionLoading}>
          {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} {t('userProfile.acceptRequest')}
        </button>)
      default: return (
        <button className={`${btnCls} ${btnCls}--secondary`} onClick={handleSendFriendRequest} disabled={actionLoading}>
          {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} {t('userProfile.addFriend')}
        </button>)
    }
  }

  const detailItems = []
  if (profileUser) {
    if (profileUser.birthday) detailItems.push({ icon: <Cake size={15} />, label: t('profile.birthday'), value: fmtBday(profileUser.birthday) })
    const gl = genderLabel(profileUser.gender)
    if (gl) detailItems.push({ icon: <User size={15} />, label: t('profile.gender'), value: gl })
    if (profileUser.phone) detailItems.push({ icon: <Phone size={15} />, label: t('profile.phone'), value: profileUser.phone })
    if (profileUser.address) detailItems.push({ icon: <MapPin size={15} />, label: t('profile.address'), value: profileUser.address })
    if (profileUser.hometown) detailItems.push({ icon: <MapPin size={15} />, label: t('profile.hometown'), value: profileUser.hometown })
    if (profileUser.occupation) detailItems.push({ icon: <Briefcase size={15} />, label: t('profile.occupation'), value: profileUser.occupation })
    if (profileUser.education) detailItems.push({ icon: <GraduationCap size={15} />, label: t('profile.education'), value: profileUser.education })
    if (profileUser.hobbies) detailItems.push({ icon: <Heart size={15} />, label: t('profile.hobbies'), value: profileUser.hobbies })
  }

  const getLabelColor = (label) => {
    switch(label) {
      case 'Khách hàng': return '#ef4444';
      case 'Gia đình': return '#22c55e';
      case 'Công việc': return '#f97316';
      case 'Bạn bè': return '#a855f7';
      case 'Khác': return '#eab308';
      default: return 'transparent';
    }
  };

  return (
    <div className="profile-modal__overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      {loading ? renderSkeleton() : error ? renderError() : profileUser?.isDeleted ? (
        <div className="user-profile-modal" style={{ display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
          <button className="profile-modal__close-btn" onClick={onClose}><X size={20} /></button>
          <div className="profile-modal__banner"><div className="profile-modal__banner-pattern" /></div>
          <div className="profile-modal__avatar-wrapper">
            <Avatar src="" alt="?" size="lg" />
          </div>
          <div className="profile-modal__body" style={{ textAlign: 'center', padding: '20px 28px 40px' }}>
            <h2 className="profile-modal__name" style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
              Người dùng đã xóa tài khoản
            </h2>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 8 }}>
              Tài khoản này đã bị xóa. Thông tin cá nhân không còn khả dụng.
            </p>
          </div>
        </div>
      ) : profileUser && (
        <div className="user-profile-modal" style={{ display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
          <button className="profile-modal__close-btn" onClick={onClose}><X size={20} /></button>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {/* Banner with cover color */}
            <div className="profile-modal__banner" style={{ background: coverGradient }}>
              <div className="profile-modal__banner-pattern" />
            </div>

            <div className="profile-modal__avatar-wrapper">
              <Avatar src={profileUser.avatar} alt={profileUser.fullName || '?'} size="lg" isOnline={isOnline} />
            </div>

            <div className="profile-modal__body" style={{ paddingBottom: 8 }}>
              <h2 className="profile-modal__name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {profileUser.fullName || t('profile.defaultName')}
                {profileUser.chatLabel && (
                  <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '12px', backgroundColor: getLabelColor(profileUser.chatLabel), color: '#fff', fontWeight: '500' }}>
                    {profileUser.chatLabel}
                  </span>
                )}
              </h2>

              {profileUser.bio && (
                <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)', margin: '4px 0 0', wordBreak: 'break-word', padding: '0 8px' }}>
                  {profileUser.bio}
                </p>
              )}

              <p className="profile-modal__subtitle" style={{ marginTop: 4 }}>
                {isOnline ? t('userProfile.online') : profileUser.lastSeen ? formatLastActive(profileUser.lastSeen, lang) : t('userProfile.offline')}
              </p>

              {/* Email */}
              <div className="profile-modal__info-list" style={{ marginTop: 12 }}>
                <div className="profile-modal__info-item" style={{ padding: '10px 14px', gap: 10 }}>
                  <div className="profile-modal__info-icon profile-modal__info-icon--purple" style={{ width: 32, height: 32, borderRadius: 8 }}>
                    <Mail size={16} />
                  </div>
                  <div className="profile-modal__info-content">
                    <span className="profile-modal__info-label">{t('profile.email')}</span>
                    <span className="profile-modal__info-value profile-modal__info-value--truncate" style={{ fontSize: 13 }}>{profileUser.email || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Expandable details */}
              {detailItems.length > 0 && (
                <>
                  <button onClick={() => setShowDetails(!showDetails)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%',
                    padding: '8px 0', marginTop: 8, border: 'none', background: 'transparent',
                    color: 'var(--color-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}>
                    {showDetails ? t('userProfile.hideDetails') : t('userProfile.viewDetails')}
                    {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {showDetails && (
                    <div className="profile-modal__info-list" style={{ marginTop: 4 }}>
                      {detailItems.map((item, idx) => (
                        <div key={idx} className="profile-modal__info-item" style={{ padding: '8px 14px', gap: 10 }}>
                          <div className="profile-modal__info-icon profile-modal__info-icon--indigo" style={{ width: 30, height: 30, borderRadius: 8 }}>
                            {item.icon}
                          </div>
                          <div className="profile-modal__info-content">
                            <span className="profile-modal__info-label">{item.label}</span>
                            <span className="profile-modal__info-value" style={{ fontSize: 13, wordBreak: 'break-word' }}>{item.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Sticky action buttons at bottom */}
          <div style={{
            padding: '12px 20px 16px', borderTop: '1px solid var(--color-border-subtle)',
            background: 'var(--color-surface)', flexShrink: 0,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <button className="user-profile-modal__action-btn user-profile-modal__action-btn--primary" onClick={handleSendMessage}>
              <MessageSquare size={16} /> {t('userProfile.sendMessage')}
            </button>
            {renderFriendButton()}
            <button className="user-profile-modal__action-btn user-profile-modal__action-btn--ghost" onClick={() => setShowReportModal(true)} style={{ color: '#ef4444' }}>
              <Flag size={16} /> Báo cáo tài khoản
            </button>
            {isBlocked ? (
              <button className="user-profile-modal__action-btn user-profile-modal__action-btn--danger" onClick={handleUnblock} disabled={actionLoading}>
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} {t('userProfile.unblock')}
              </button>
            ) : (
              <button className="user-profile-modal__action-btn user-profile-modal__action-btn--ghost" onClick={handleBlock} disabled={actionLoading}>
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <ShieldBan size={16} />} {t('userProfile.block')}
              </button>
            )}
          </div>

          {showReportModal && (
            <ReportModal
              isOpen={showReportModal}
              onClose={() => setShowReportModal(false)}
              reportedUserId={userId}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default UserProfileModal
