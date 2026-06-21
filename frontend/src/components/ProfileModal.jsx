import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LogOut, Mail, User, Camera, Pencil, Save, X, Lock, Eye, EyeOff,
  Cake, MapPin, Heart, Briefcase, GraduationCap, Phone,
  Upload, Image, Trash2
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useLang } from '../context/LangContext'
import { authService } from '../services/auth.service'
import { userService } from '../services/user.service'
import { useElementAspect } from '../hooks/useElementAspect'
import { getCoverBackground, getCoverGradient, getImageSize } from '../utils/coverUtils'
import Avatar from './ui/Avatar'
import Button from './ui/Button'
import ConfirmModal from './ui/ConfirmModal'

const DEFAULT_AVATARS = Array.from({ length: 16 }, (_, i) => `/default_avatar/avatar_${i + 1}.png`)

function ProfileModal({ isOpen, onClose }) {
  const { user, logout, updateUser } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const { t, lang } = useLang()
  const [loggingOut, setLoggingOut] = useState(false)

  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({ fullName: '', avatar: '' })
  const [coverImageAspect, setCoverImageAspect] = useState(null)
  const fileInputRef = useRef(null)
  const bannerRef = useRef(null)
  const coverBannerAspect = useElementAspect(bannerRef)
  const [formErrors, setFormErrors] = useState({})

  const [showPasswordSection, setShowPasswordSection] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordErrors, setPasswordErrors] = useState({})
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)

  const [showAvatarMenu, setShowAvatarMenu] = useState(false)
  const [showDefaultAvatars, setShowDefaultAvatars] = useState(false)
  const avatarMenuRef = useRef(null)

  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null, danger: false })

  useEffect(() => {
    function handleClick(e) {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target)) setShowAvatarMenu(false)
    }
    if (showAvatarMenu) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showAvatarMenu])

  function startEditing() {
    setFormData({ fullName: user?.fullName || '', avatar: user?.avatar || '' })
    setFormErrors({})
    setIsEditing(true)
  }

  function cancelEditing() {
    setIsEditing(false)
    setFormErrors({})
    setShowDefaultAvatars(false)
    setShowAvatarMenu(false)
  }

  function handleChange(e) {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }))
  }

  function handlePasswordChange(e) {
    const { name, value } = e.target
    setPasswordData(prev => ({ ...prev, [name]: value }))
    if (passwordErrors[name]) setPasswordErrors(prev => ({ ...prev, [name]: '' }))
  }

  function validateForm() {
    const errors = {}
    if (!formData.fullName.trim()) errors.fullName = t('validation.required')
    return errors
  }

  function validatePassword() {
    const errors = {}
    if (!passwordData.currentPassword) errors.currentPassword = t('validation.required')
    if (!passwordData.newPassword) errors.newPassword = t('validation.required')
    else if (passwordData.newPassword.length < 6) errors.newPassword = t('validation.passwordMinLength')
    if (!passwordData.confirmPassword) errors.confirmPassword = t('validation.required')
    else if (passwordData.newPassword !== passwordData.confirmPassword) errors.confirmPassword = t('validation.passwordMismatch')
    return errors
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, avatar: reader.result }))
      setShowAvatarMenu(false)
    }
  }

  function handleSelectDefaultAvatar(url) {
    setFormData(prev => ({ ...prev, avatar: url }))
    setShowDefaultAvatars(false)
    setShowAvatarMenu(false)
  }

  function handleRemoveAvatar() {
    setConfirmModal({
      open: true,
      title: t('profile.confirmRemoveAvatar'),
      message: t('profile.confirmRemoveAvatarMsg'),
      danger: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, open: false }))
        try {
          const updated = await userService.removeAvatar()
          updateUser(updated)
          setFormData(prev => ({ ...prev, avatar: '' }))
          toast.success(t('profile.removeAvatarSuccess'))
        } catch (err) {
          toast.error(err.response?.data?.message || t('profile.updateError'))
        }
      }
    })
    setShowAvatarMenu(false)
  }

  async function handleSave() {
    const errors = validateForm()
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return }

    setConfirmModal({
      open: true,
      title: t('profile.confirmSaveProfile'),
      message: t('profile.confirmSaveProfileMsg'),
      danger: false,
      onConfirm: () => { setConfirmModal(prev => ({ ...prev, open: false })); doSave() }
    })
  }

  async function doSave() {
    setSaving(true)
    try {
      const payload = {}
      if (formData.fullName.trim() !== (user?.fullName || '')) payload.fullName = formData.fullName.trim()
      if (formData.avatar !== (user?.avatar || '')) payload.avatar = formData.avatar

      if (Object.keys(payload).length === 0) {
        toast.info(t('profile.noChanges'))
        setIsEditing(false)
        setSaving(false)
        return
      }
      const updatedUser = await userService.updateProfile(payload)
      updateUser(updatedUser)
      toast.success(t('profile.updateSuccess'))
      setIsEditing(false)
    } catch (error) {
      toast.error(error.response?.data?.message || t('profile.updateError'))
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword() {
    const errors = validatePassword()
    if (Object.keys(errors).length > 0) { setPasswordErrors(errors); return }

    setConfirmModal({
      open: true,
      title: t('profile.confirmChangePassword'),
      message: t('profile.confirmChangePasswordMsg'),
      danger: false,
      onConfirm: () => { setConfirmModal(prev => ({ ...prev, open: false })); doChangePassword() }
    })
  }

  async function doChangePassword() {
    setChangingPassword(true)
    try {
      await userService.changePassword({ currentPassword: passwordData.currentPassword, newPassword: passwordData.newPassword })
      toast.success(t('profile.passwordChangeSuccess'))
      setShowPasswordSection(false)
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPasswordErrors({})
    } catch (error) {
      toast.error(error.response?.data?.message || t('profile.passwordChangeError'))
    } finally {
      setChangingPassword(false)
    }
  }

  async function handleLogout() {
    setLoggingOut(true)
    try { await authService.logout() } catch (error) { console.warn('Logout request failed', error) }
    logout()
    toast.success(t('profile.logoutSuccess'))
    navigate('/login', { replace: true })
    setLoggingOut(false)
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose()
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

  const activeCoverImage = user?.coverOriginalImage || user?.coverImage || ''
  const activeCoverBackground = getCoverBackground(user?.coverCropArea, coverImageAspect, coverBannerAspect || 11 / 3)
  const bannerClassName = `profile-modal__banner ${activeCoverImage ? '' : 'profile-modal__banner--generated'}`
  const bannerStyle = activeCoverImage
    ? {
        backgroundImage: `url("${activeCoverImage}")`,
        backgroundSize: activeCoverBackground.size,
        backgroundPosition: activeCoverBackground.position,
        backgroundRepeat: 'no-repeat',
      }
    : { background: getCoverGradient(user?.coverColor) }

  useEffect(() => {
    let cancelled = false

    if (!activeCoverImage) {
      setCoverImageAspect(null)
      return undefined
    }

    getImageSize(activeCoverImage)
      .then(({ width, height }) => {
        if (!cancelled) setCoverImageAspect(width && height ? width / height : null)
      })
      .catch(() => {
        if (!cancelled) setCoverImageAspect(null)
      })

    return () => { cancelled = true }
  }, [activeCoverImage])

  if (!isOpen) return null

  const renderInfoItem = (icon, label, value, iconCls) => {
    if (!value) return null
    return (
      <div className="profile-modal__info-item" style={{ padding: '10px 14px', gap: 10 }}>
        <div className={`profile-modal__info-icon profile-modal__info-icon--${iconCls}`} style={{ width: 32, height: 32, borderRadius: 8 }}>
          {icon}
        </div>
        <div className="profile-modal__info-content">
          <span className="profile-modal__info-label">{label}</span>
          <span className="profile-modal__info-value" style={{ fontSize: 13, wordBreak: 'break-word' }}>{value}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="profile-modal__overlay" onClick={handleOverlayClick}>
      <div className="profile-modal">
        <button className="profile-modal__close-btn" onClick={onClose}><X size={20} /></button>

        <div ref={bannerRef} className={bannerClassName} style={bannerStyle}>
          <div className="profile-modal__banner-pattern"></div>
          {!isEditing && (
            <button onClick={startEditing} className="profile-modal__edit-btn" title={t('profile.edit')}>
              <Pencil size={16} />
            </button>
          )}
        </div>

        <div className="profile-modal__avatar-wrapper">
          <div className="profile-modal__avatar-group" ref={avatarMenuRef}>
            <div className="profile-modal__avatar-backdrop" aria-hidden="true" />
            <Avatar
              src={isEditing ? formData.avatar : user?.avatar}
              alt={user?.fullName || 'User'}
              size="lg"
              isOnline={user?.showActiveStatus !== false}
            />
            {isEditing && (
              <>
                <button
                  className="profile-modal__camera-btn"
                  onClick={() => setShowAvatarMenu(!showAvatarMenu)}
                  style={{ width: 32, height: 32 }}
                >
                  <Camera size={16} />
                </button>

                {showAvatarMenu && (
                  <div style={{
                    position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                    marginTop: 4, background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    borderRadius: 12, boxShadow: 'var(--shadow-md)', overflow: 'hidden', zIndex: 50, minWidth: 200,
                  }}>
                    <button
                      onClick={() => { fileInputRef.current.click(); setShowAvatarMenu(false) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', border: 'none', background: 'transparent', color: 'var(--color-text)', fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-hover-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <Upload size={16} style={{ color: 'var(--color-primary)' }} />
                      {t('profile.uploadAvatar')}
                    </button>
                    <button
                      onClick={() => { setShowDefaultAvatars(true); setShowAvatarMenu(false) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', border: 'none', background: 'transparent', color: 'var(--color-text)', fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-hover-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <Image size={16} style={{ color: '#7c3aed' }} />
                      {t('profile.chooseDefaultAvatar')}
                    </button>
                    {(user?.avatar || formData.avatar) && (
                      <button
                        onClick={handleRemoveAvatar}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', border: 'none', background: 'transparent', color: '#ef4444', fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <Trash2 size={16} />
                        {t('profile.removeAvatar')}
                      </button>
                    )}
                  </div>
                )}

                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} style={{ display: 'none' }} />
              </>
            )}
          </div>
        </div>

        {/* Default Avatars Grid */}
        {showDefaultAvatars && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          }} onClick={() => setShowDefaultAvatars(false)}>
            <div style={{
              background: 'var(--color-surface)', borderRadius: 16, padding: 20,
              maxWidth: 340, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>{t('profile.defaultAvatarTitle')}</h3>
                <button onClick={() => setShowDefaultAvatars(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-text-muted)' }}>
                  <X size={18} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {DEFAULT_AVATARS.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectDefaultAvatar(url)}
                    style={{
                      borderRadius: 10, overflow: 'hidden', cursor: 'pointer', padding: 0,
                      border: formData.avatar === url ? '2px solid var(--color-primary)' : '2px solid transparent',
                      background: 'transparent', transition: 'all 0.15s',
                    }}
                  >
                    <img src={url} alt={`Avatar ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', aspectRatio: '1' }} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="profile-modal__body">
          <h2 className="profile-modal__name">{user?.fullName || t('profile.defaultName')}</h2>
          {user?.bio && !isEditing && (
            <p className="profile-modal__subtitle" style={{ maxWidth: 300, margin: '2px auto 0', wordBreak: 'break-word' }}>{user.bio}</p>
          )}
          {!user?.bio && !isEditing && (
            <p className="profile-modal__subtitle">{t('profile.title')}</p>
          )}

          {!isEditing && (
            <>
              <div className="profile-modal__info-list">
                <div className="profile-modal__info-item">
                  <div className="profile-modal__info-icon profile-modal__info-icon--indigo"><User size={18} /></div>
                  <div className="profile-modal__info-content">
                    <span className="profile-modal__info-label">{t('profile.fullName')}</span>
                    <span className="profile-modal__info-value">{user?.fullName || '—'}</span>
                  </div>
                </div>
                <div className="profile-modal__info-item">
                  <div className="profile-modal__info-icon profile-modal__info-icon--purple"><Mail size={18} /></div>
                  <div className="profile-modal__info-content">
                    <span className="profile-modal__info-label">{t('profile.email')}</span>
                    <span className="profile-modal__info-value profile-modal__info-value--truncate">{user?.email || '—'}</span>
                  </div>
                </div>

                {renderInfoItem(<Cake size={16} />, t('profile.birthday'), formatBirthday(user?.birthday), 'purple')}
                {renderInfoItem(<User size={16} />, t('profile.gender'), getGenderLabel(user?.gender), 'indigo')}
                {renderInfoItem(<Phone size={16} />, t('profile.phone'), user?.phone, 'emerald')}
                {renderInfoItem(<MapPin size={16} />, t('profile.address'), user?.address, 'purple')}
                {renderInfoItem(<MapPin size={16} />, t('profile.hometown'), user?.hometown, 'indigo')}
                {renderInfoItem(<Briefcase size={16} />, t('profile.occupation'), user?.occupation, 'emerald')}
                {renderInfoItem(<GraduationCap size={16} />, t('profile.education'), user?.education, 'purple')}
                {renderInfoItem(<Heart size={16} />, t('profile.hobbies'), user?.hobbies, 'indigo')}
              </div>

              <div className="profile-modal__password-section">
                {!showPasswordSection ? (
                  <button onClick={() => setShowPasswordSection(true)} className="profile-modal__password-toggle">
                    <Lock size={16} /> {t('profile.changePassword')}
                  </button>
                ) : (
                  <div className="profile-modal__password-form">
                    <h3 className="profile-modal__password-title"><Lock size={14} /> {t('profile.changePassword')}</h3>

                    {[
                      { name: 'currentPassword', label: t('profile.currentPassword'), ph: t('profile.currentPasswordPlaceholder'), show: showCurrentPw, setShow: setShowCurrentPw },
                      { name: 'newPassword', label: t('profile.newPassword'), ph: t('profile.newPasswordPlaceholder'), show: showNewPw, setShow: setShowNewPw },
                      { name: 'confirmPassword', label: t('profile.confirmNewPassword'), ph: t('profile.confirmNewPasswordPlaceholder'), show: showConfirmPw, setShow: setShowConfirmPw },
                    ].map(f => (
                      <div className="profile-modal__field" key={f.name}>
                        <label>{f.label}</label>
                        <div className="profile-modal__input-wrapper">
                          <input
                            type={f.show ? 'text' : 'password'}
                            name={f.name}
                            value={passwordData[f.name]}
                            onChange={handlePasswordChange}
                            className={`profile-modal__input ${passwordErrors[f.name] ? 'profile-modal__input--error' : ''}`}
                            placeholder={f.ph}
                          />
                          <button type="button" onClick={() => f.setShow(!f.show)} className="profile-modal__eye-btn">
                            {f.show ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        {passwordErrors[f.name] && <p className="profile-modal__error">{passwordErrors[f.name]}</p>}
                      </div>
                    ))}

                    <div className="profile-modal__btn-row">
                      <Button variant="primary" className="flex-1 !text-sm !py-2" onClick={handleChangePassword} isLoading={changingPassword}>
                        <Save size={14} /> {t('profile.save')}
                      </Button>
                      <Button variant="secondary" className="flex-1 !text-sm !py-2" onClick={() => { setShowPasswordSection(false); setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' }); setPasswordErrors({}) }} disabled={changingPassword}>
                        <X size={14} /> {t('profile.cancel')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="profile-modal__logout">
                <Button variant="danger" className="w-full" onClick={handleLogout} isLoading={loggingOut}>
                  <LogOut size={18} /> {t('profile.logout')}
                </Button>
              </div>
            </>
          )}

          {isEditing && (
            <div className="profile-modal__edit-form">
              <div className="profile-modal__field">
                <label><User size={14} /> {t('profile.fullName')}</label>
                <input
                  type="text" name="fullName" value={formData.fullName} onChange={handleChange}
                  className={`profile-modal__input ${formErrors.fullName ? 'profile-modal__input--error' : ''}`}
                  placeholder={t('profile.fullNamePlaceholder')}
                />
                {formErrors.fullName && <p className="profile-modal__error">{formErrors.fullName}</p>}
              </div>

              <div className="profile-modal__btn-row">
                <Button variant="primary" className="flex-1" onClick={handleSave} isLoading={saving}>
                  <Save size={16} /> {t('profile.save')}
                </Button>
                <Button variant="secondary" className="flex-1" onClick={cancelEditing} disabled={saving}>
                  <X size={16} /> {t('profile.cancel')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, open: false }))}
        confirmText={t('profile.yes')}
        cancelText={t('profile.no')}
        danger={confirmModal.danger}
      />
    </div>
  )
}

export default ProfileModal
