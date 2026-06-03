import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LogOut, Mail, User, Camera, Pencil, Save, X, Lock, Eye, EyeOff,
  Cake, MapPin, Heart, Briefcase, GraduationCap, Phone, Globe, Users, ShieldCheck,
  Upload, Image, Trash2, ChevronDown, Palette
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useLang } from '../context/LangContext'
import { authService } from '../services/auth.service'
import { userService } from '../services/user.service'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import ConfirmModal from '../components/ui/ConfirmModal'

const DEFAULT_AVATARS = Array.from({ length: 16 }, (_, i) => `/default_avatar/avatar_${i + 1}.png`)

const COVER_COLORS = [
  { value: '', gradient: 'linear-gradient(135deg, #4f46e5, #7c3aed)' },
  { value: 'blue', gradient: 'linear-gradient(135deg, #2563eb, #0ea5e9)' },
  { value: 'cyan', gradient: 'linear-gradient(135deg, #0891b2, #06b6d4)' },
  { value: 'teal', gradient: 'linear-gradient(135deg, #0d9488, #14b8a6)' },
  { value: 'green', gradient: 'linear-gradient(135deg, #16a34a, #22c55e)' },
  { value: 'orange', gradient: 'linear-gradient(135deg, #ea580c, #f97316)' },
  { value: 'red', gradient: 'linear-gradient(135deg, #dc2626, #ef4444)' },
  { value: 'pink', gradient: 'linear-gradient(135deg, #db2777, #ec4899)' },
  { value: 'purple', gradient: 'linear-gradient(135deg, #7c3aed, #a855f7)' },
  { value: 'slate', gradient: 'linear-gradient(135deg, #475569, #64748b)' },
  { value: 'rose', gradient: 'linear-gradient(135deg, #e11d48, #f43f5e)' },
  { value: 'amber', gradient: 'linear-gradient(135deg, #d97706, #f59e0b)' },
]

function getCoverGradient(coverColor) {
  const found = COVER_COLORS.find(c => c.value === coverColor)
  return found ? found.gradient : COVER_COLORS[0].gradient
}

const VISIBILITY_OPTIONS = [
  { value: 'private', icon: ShieldCheck, color: '#ef4444' },
  { value: 'friends', icon: Users, color: '#3b82f6' },
  { value: 'public', icon: Globe, color: '#22c55e' },
]

function VisibilitySelect({ value, onChange, t }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = VISIBILITY_OPTIONS.find(o => o.value === value) || VISIBILITY_OPTIONS[1]

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px',
          borderRadius: 6, border: '1px solid var(--color-border-subtle)',
          background: 'var(--color-bg)', color: current.color, fontSize: 11,
          fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        <current.icon size={12} />
        {t(`profile.visibility${value.charAt(0).toUpperCase() + value.slice(1)}`)}
        <ChevronDown size={10} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 50,
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 8, boxShadow: 'var(--shadow-md)', overflow: 'hidden', minWidth: 130,
        }}>
          {VISIBILITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '8px 12px', border: 'none', background: value === opt.value ? 'var(--color-hover-bg)' : 'transparent',
                color: opt.color, fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
              }}
            >
              <opt.icon size={14} />
              {t(`profile.visibility${opt.value.charAt(0).toUpperCase() + opt.value.slice(1)}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ProfilePage() {
  const { user, logout, updateUser } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const { t, lang } = useLang()
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    authService.getMe().then(data => {
      if (data && data._id) updateUser(data)
    }).catch(() => {})
  }, [])

  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({})
  const [visibilityData, setVisibilityData] = useState({})
  const fileInputRef = useRef(null)
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
  const [showCoverPicker, setShowCoverPicker] = useState(false)
  const avatarMenuRef = useRef(null)
  const coverPickerRef = useRef(null)

  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null, danger: false })

  useEffect(() => {
    function handleClick(e) {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target)) setShowAvatarMenu(false)
      if (coverPickerRef.current && !coverPickerRef.current.contains(e.target)) setShowCoverPicker(false)
    }
    if (showAvatarMenu || showCoverPicker) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showAvatarMenu, showCoverPicker])

  function startEditing() {
    setFormData({
      fullName: user?.fullName || '',
      avatar: user?.avatar || '',
      coverColor: user?.coverColor || '',
      birthday: user?.birthday ? new Date(user.birthday).toISOString().split('T')[0] : '',
      gender: user?.gender || '',
      phone: user?.phone || '',
      address: user?.address || '',
      hometown: user?.hometown || '',
      hobbies: user?.hobbies || '',
      occupation: user?.occupation || '',
      education: user?.education || '',
      bio: user?.bio || '',
    })
    setVisibilityData({
      birthday: user?.profileVisibility?.birthday || 'friends',
      gender: user?.profileVisibility?.gender || 'friends',
      phone: user?.profileVisibility?.phone || 'friends',
      address: user?.profileVisibility?.address || 'friends',
      hometown: user?.profileVisibility?.hometown || 'friends',
      hobbies: user?.profileVisibility?.hobbies || 'public',
      occupation: user?.profileVisibility?.occupation || 'public',
      education: user?.profileVisibility?.education || 'public',
      bio: user?.profileVisibility?.bio || 'public',
    })
    setFormErrors({})
    setIsEditing(true)
  }

  function cancelEditing() {
    setIsEditing(false)
    setFormErrors({})
    setShowDefaultAvatars(false)
  }

  function handleChange(e) {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }))
  }

  function handleVisibilityChange(field, value) {
    setVisibilityData(prev => ({ ...prev, [field]: value }))
  }

  function handlePasswordChange(e) {
    const { name, value } = e.target
    setPasswordData(prev => ({ ...prev, [name]: value }))
    if (passwordErrors[name]) setPasswordErrors(prev => ({ ...prev, [name]: '' }))
  }

  function validateForm() {
    const errors = {}
    if (!formData.fullName.trim()) errors.fullName = t('validation.required')
    if (formData.birthday) {
      const d = new Date(formData.birthday)
      if (isNaN(d.getTime()) || d > new Date()) errors.birthday = t('profile.birthdayInvalid')
    }
    if (formData.bio && formData.bio.length > 500) errors.bio = t('profile.bioTooLong')
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
      setShowDefaultAvatars(false)
    }
  }

  function handleSelectDefaultAvatar(url) {
    setFormData(prev => ({ ...prev, avatar: url }))
    setShowDefaultAvatars(false)
    setShowAvatarMenu(false)
  }

  function handleRemoveAvatar() {
    setConfirmModal({
      open: true, title: t('profile.confirmRemoveAvatar'), message: t('profile.confirmRemoveAvatarMsg'), danger: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, open: false }))
        try {
          const updated = await userService.removeAvatar()
          updateUser(updated)
          setFormData(prev => ({ ...prev, avatar: '' }))
          toast.success(t('profile.removeAvatarSuccess'))
        } catch (err) { toast.error(err.response?.data?.message || t('profile.updateError')) }
      }
    })
    setShowAvatarMenu(false)
  }

  async function handleSave() {
    const errors = validateForm()
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return }
    setConfirmModal({
      open: true, title: t('profile.confirmSaveProfile'), message: t('profile.confirmSaveProfileMsg'), danger: false,
      onConfirm: () => { setConfirmModal(prev => ({ ...prev, open: false })); doSave() }
    })
  }

  async function doSave() {
    setSaving(true)
    try {
      const payload = {}
      const fields = ['fullName', 'birthday', 'gender', 'phone', 'address', 'hometown', 'hobbies', 'occupation', 'education', 'bio']
      for (const f of fields) {
        const newVal = (formData[f] ?? '').toString().trim()
        const oldVal = (user?.[f] ?? '').toString().trim()
        if (f === 'birthday') {
          const newDate = newVal ? new Date(newVal).toISOString().split('T')[0] : ''
          const oldDate = user?.birthday ? new Date(user.birthday).toISOString().split('T')[0] : ''
          if (newDate !== oldDate) payload[f] = newVal || null
        } else if (newVal !== oldVal) {
          payload[f] = newVal
        }
      }
      if (formData.avatar !== (user?.avatar || '')) payload.avatar = formData.avatar
      if (formData.coverColor !== (user?.coverColor || '')) payload.coverColor = formData.coverColor || ''
      const oldVis = user?.profileVisibility || {}
      const visDiff = {}
      for (const f of Object.keys(visibilityData)) {
        if (visibilityData[f] !== (oldVis[f] || 'friends')) visDiff[f] = visibilityData[f]
      }
      if (Object.keys(visDiff).length > 0) payload.profileVisibility = visDiff
      if (Object.keys(payload).length === 0) { toast.info(t('profile.noChanges')); setIsEditing(false); setSaving(false); return }
      const updatedUser = await userService.updateProfile(payload)
      updateUser(updatedUser)
      toast.success(t('profile.updateSuccess'))
      setIsEditing(false)
    } catch (error) { toast.error(error.response?.data?.message || t('profile.updateError')) }
    finally { setSaving(false) }
  }

  async function handleChangePassword() {
    const errors = validatePassword()
    if (Object.keys(errors).length > 0) { setPasswordErrors(errors); return }
    setConfirmModal({
      open: true, title: t('profile.confirmChangePassword'), message: t('profile.confirmChangePasswordMsg'), danger: false,
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
    } catch (error) { toast.error(error.response?.data?.message || t('profile.passwordChangeError')) }
    finally { setChangingPassword(false) }
  }

  async function handleLogout() {
    setLoggingOut(true)
    try { await authService.logout() } catch {}
    logout()
    toast.success(t('profile.logoutSuccess'))
    navigate('/login', { replace: true })
    setLoggingOut(false)
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

  const activeCoverGradient = isEditing
    ? getCoverGradient(formData.coverColor)
    : getCoverGradient(user?.coverColor)

  const s = {
    page: { minHeight: '100vh', background: 'var(--color-bg)', overflowY: 'auto' },
    banner: {
      height: 220, background: activeCoverGradient,
      position: 'relative', overflow: 'hidden',
    },
    bannerPattern: {
      position: 'absolute', inset: 0, opacity: 0.08,
      backgroundImage: 'repeating-linear-gradient(45deg,transparent,transparent 30px,rgba(255,255,255,0.1) 30px,rgba(255,255,255,0.1) 60px)',
    },
    editBtnBanner: {
      position: 'absolute', top: 16, right: 24, padding: '8px 16px', borderRadius: 12,
      background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)',
      border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 14, fontWeight: 600, transition: 'background 0.15s',
    },
    container: { maxWidth: 960, margin: '0 auto', padding: '0 24px' },
    headerSection: {
      display: 'flex', alignItems: 'flex-end', gap: 24, marginTop: -60, position: 'relative', zIndex: 5, flexWrap: 'wrap',
    },
    avatarWrap: { position: 'relative', flexShrink: 0 },
    nameSection: { flex: 1, minWidth: 0, paddingBottom: 10 },
    nameText: { margin: 0, fontSize: 32, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.2 },
    bioText: { margin: '6px 0 0', fontSize: 16, color: 'var(--color-text-muted)', wordBreak: 'break-word' },
    sectionTitle: {
      fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase',
      letterSpacing: 0.5, margin: '0 0 12px', padding: '0 2px',
    },
    infoCard: {
      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
      borderRadius: 12, background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)',
      transition: 'border-color 0.15s, background 0.15s',
    },
    infoIcon: (bg, color) => ({
      width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, background: bg, color: color,
    }),
    infoLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--color-text-muted)', fontWeight: 600 },
    infoValue: { fontSize: 14, fontWeight: 600, color: 'var(--color-text)', wordBreak: 'break-word' },
    grid2: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 },
    grid1: { display: 'grid', gridTemplateColumns: '1fr', gap: 12 },
    section: { marginTop: 28 },
    divider: { height: 1, background: 'var(--color-border-subtle)', margin: '24px 0' },
    input: (hasError) => ({
      width: '100%', padding: '10px 14px', borderRadius: 10,
      border: `1px solid ${hasError ? '#ef4444' : 'var(--color-input-border)'}`,
      background: 'var(--color-input-bg)', color: 'var(--color-text)', fontSize: 14, outline: 'none',
      transition: 'border-color 0.15s, box-shadow 0.15s',
      boxShadow: hasError ? '0 0 0 3px rgba(239,68,68,0.15)' : 'none',
    }),
    fieldLabel: {
      display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, textTransform: 'uppercase',
      letterSpacing: 0.5, color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 6,
    },
    error: { margin: '4px 0 0', fontSize: 12, color: '#ef4444' },
    avatarMenu: {
      position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 8,
      background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12,
      boxShadow: 'var(--shadow-md)', overflow: 'hidden', zIndex: 50, minWidth: 210,
    },
    avatarMenuItem: (danger) => ({
      display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px',
      border: 'none', background: 'transparent', color: danger ? '#ef4444' : 'var(--color-text)',
      fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s',
    }),
    pwBtn: {
      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: '10px 16px', borderRadius: 12, border: '1px solid var(--color-border)',
      background: 'transparent', color: 'var(--color-text)', fontSize: 14, fontWeight: 500,
      cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
    },
    pwForm: {
      padding: 16, borderRadius: 14, background: 'var(--color-surface)',
      border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 12,
    },
    backLink: {
      display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-primary)',
      fontSize: 14, fontWeight: 600, textDecoration: 'none', cursor: 'pointer',
    },
  }

  const ICON_STYLES = {
    indigo: { bg: 'var(--color-primary-light)', color: 'var(--color-primary)' },
    purple: { bg: 'rgba(124,58,237,0.1)', color: '#7c3aed' },
    emerald: { bg: 'rgba(16,185,129,0.1)', color: '#10b981' },
    blue: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' },
  }

  const renderInfoCard = (icon, label, value, cls = 'indigo') => {
    if (!value) return null
    const ic = ICON_STYLES[cls] || ICON_STYLES.indigo
    return (
      <div style={s.infoCard}>
        <div style={s.infoIcon(ic.bg, ic.color)}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={s.infoLabel}>{label}</span>
          <span style={s.infoValue}>{value}</span>
        </div>
      </div>
    )
  }

  const renderEditField = (name, label, icon, type = 'text', placeholder = '', options = null) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={s.fieldLabel}>{icon} {label}</label>
        <VisibilitySelect value={visibilityData[name] || 'friends'} onChange={v => handleVisibilityChange(name, v)} t={t} />
      </div>
      {options ? (
        <select name={name} value={formData[name] || ''} onChange={handleChange} style={s.input(false)}>
          <option value="">{t('profile.genderSelect')}</option>
          {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea name={name} value={formData[name] || ''} onChange={handleChange} placeholder={placeholder} rows={3}
          style={{ ...s.input(!!formErrors[name]), resize: 'none' }} />
      ) : (
        <input type={type} name={name} value={formData[name] || ''} onChange={handleChange} placeholder={placeholder}
          style={s.input(!!formErrors[name])} />
      )}
      {formErrors[name] && <p style={s.error}>{formErrors[name]}</p>}
    </div>
  )

  const hasExtendedInfo = user?.birthday || user?.gender || user?.phone || user?.address || user?.hometown || user?.hobbies || user?.occupation || user?.education

  return (
    <div style={s.page}>
      {/* Banner */}
      <div style={s.banner}>
        <div style={s.bannerPattern} />
        {!isEditing && (
          <button style={s.editBtnBanner} onClick={startEditing}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          >
            <Pencil size={16} /> {t('profile.editProfile')}
          </button>
        )}
        {isEditing && (
          <div ref={coverPickerRef} style={{ position: 'absolute', bottom: 12, right: 24 }}>
            <button
              onClick={() => setShowCoverPicker(!showCoverPicker)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 10,
                background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)',
                border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}
            >
              <Palette size={16} /> {t('profile.coverColor') || 'Màu nền'}
            </button>
            {showCoverPicker && (
              <div style={{
                position: 'absolute', bottom: '100%', right: 0, marginBottom: 8,
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                borderRadius: 12, boxShadow: 'var(--shadow-md)', padding: 10, zIndex: 50,
                display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, width: 220,
              }}>
                {COVER_COLORS.map(c => (
                  <button key={c.value} onClick={() => { setFormData(prev => ({ ...prev, coverColor: c.value })); setShowCoverPicker(false) }}
                    style={{
                      width: 30, height: 30, borderRadius: 8, background: c.gradient, border: formData.coverColor === c.value ? '3px solid #fff' : '2px solid transparent',
                      cursor: 'pointer', boxShadow: formData.coverColor === c.value ? '0 0 0 2px var(--color-primary)' : 'none',
                      transition: 'all 0.1s',
                    }} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={s.container}>
        {/* Header: avatar + name */}
        <div style={s.headerSection}>
          <div style={s.avatarWrap} ref={avatarMenuRef}>
            <Avatar src={isEditing ? formData.avatar : user?.avatar} alt={user?.fullName || 'User'} size="xl" isOnline={user?.showActiveStatus !== false} />
            {isEditing && (
              <>
                <button onClick={() => setShowAvatarMenu(!showAvatarMenu)}
                  style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Camera size={22} color="#fff" />
                </button>
                {showAvatarMenu && (
                  <div style={s.avatarMenu}>
                    <button style={s.avatarMenuItem(false)} onClick={() => { fileInputRef.current.click(); setShowAvatarMenu(false) }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-hover-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <Upload size={16} style={{ color: 'var(--color-primary)' }} /> {t('profile.uploadAvatar')}
                    </button>
                    <button style={s.avatarMenuItem(false)} onClick={() => { setShowDefaultAvatars(true); setShowAvatarMenu(false) }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-hover-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <Image size={16} style={{ color: '#7c3aed' }} /> {t('profile.chooseDefaultAvatar')}
                    </button>
                    {(user?.avatar || formData.avatar) && (
                      <button style={s.avatarMenuItem(true)} onClick={handleRemoveAvatar}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <Trash2 size={16} /> {t('profile.removeAvatar')}
                      </button>
                    )}
                  </div>
                )}
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} style={{ display: 'none' }} />
              </>
            )}
          </div>
          <div style={s.nameSection}>
            <h1 style={s.nameText}>{user?.fullName || t('profile.defaultName')}</h1>
            {user?.bio && !isEditing && <p style={s.bioText}>{user.bio}</p>}
            {!user?.bio && !isEditing && <p style={s.bioText}>{t('profile.title')}</p>}
          </div>
        </div>

        {/* Default Avatars Grid Modal */}
        {showDefaultAvatars && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
            onClick={() => setShowDefaultAvatars(false)}>
            <div style={{ background: 'var(--color-surface)', borderRadius: 16, padding: 24, maxWidth: 360, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--color-text)' }}>{t('profile.defaultAvatarTitle')}</h3>
                <button onClick={() => setShowDefaultAvatars(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--color-text-muted)' }}>
                  <X size={20} />
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {DEFAULT_AVATARS.map((url, i) => (
                  <button key={i} onClick={() => handleSelectDefaultAvatar(url)}
                    style={{ borderRadius: 10, overflow: 'hidden', cursor: 'pointer', padding: 0, border: formData.avatar === url ? '3px solid var(--color-primary)' : '3px solid transparent', background: 'transparent', transition: 'all 0.15s' }}>
                    <img src={url} alt={`Avatar ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', aspectRatio: '1', display: 'block' }} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== VIEW MODE ===== */}
        {!isEditing && (
          <>
            {/* Basic Info */}
            <div style={s.section}>
              <h3 style={s.sectionTitle}>{t('profile.personalInfo')}</h3>
              <div style={s.grid2}>
                {renderInfoCard(<User size={18} />, t('profile.fullName'), user?.fullName, 'indigo')}
                {renderInfoCard(<Mail size={18} />, t('profile.email'), user?.email, 'purple')}
              </div>
            </div>

            {/* Extended Info - 2 column grid */}
            {hasExtendedInfo && (
              <div style={s.section}>
                <h3 style={s.sectionTitle}>{t('profile.aboutMe')}</h3>
                <div style={s.grid2}>
                  {renderInfoCard(<Cake size={18} />, t('profile.birthday'), formatBirthday(user?.birthday), 'purple')}
                  {renderInfoCard(<User size={18} />, t('profile.gender'), getGenderLabel(user?.gender), 'indigo')}
                  {renderInfoCard(<Phone size={18} />, t('profile.phone'), user?.phone, 'emerald')}
                  {renderInfoCard(<MapPin size={18} />, t('profile.address'), user?.address, 'blue')}
                  {renderInfoCard(<MapPin size={18} />, t('profile.hometown'), user?.hometown, 'purple')}
                  {renderInfoCard(<Briefcase size={18} />, t('profile.occupation'), user?.occupation, 'emerald')}
                  {renderInfoCard(<GraduationCap size={18} />, t('profile.education'), user?.education, 'purple')}
                  {renderInfoCard(<Heart size={18} />, t('profile.hobbies'), user?.hobbies, 'indigo')}
                </div>
              </div>
            )}

            <div style={s.divider} />

            {/* Password */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '100%', maxWidth: 520 }}>
                {!showPasswordSection ? (
                  <button style={s.pwBtn} onClick={() => setShowPasswordSection(true)}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-hover-bg)'; e.currentTarget.style.borderColor = 'var(--color-primary)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--color-border)' }}>
                    <Lock size={16} /> {t('profile.changePassword')}
                  </button>
                ) : (
                  <div style={s.pwForm}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Lock size={14} /> {t('profile.changePassword')}
                    </h3>
                    {[
                      { name: 'currentPassword', label: t('profile.currentPassword'), placeholder: t('profile.currentPasswordPlaceholder'), show: showCurrentPw, setShow: setShowCurrentPw },
                      { name: 'newPassword', label: t('profile.newPassword'), placeholder: t('profile.newPasswordPlaceholder'), show: showNewPw, setShow: setShowNewPw },
                      { name: 'confirmPassword', label: t('profile.confirmNewPassword'), placeholder: t('profile.confirmNewPasswordPlaceholder'), show: showConfirmPw, setShow: setShowConfirmPw },
                    ].map(field => (
                      <div key={field.name}>
                        <label style={s.fieldLabel}>{field.label}</label>
                        <div style={{ position: 'relative' }}>
                          <input type={field.show ? 'text' : 'password'} name={field.name} value={passwordData[field.name]}
                            onChange={handlePasswordChange} placeholder={field.placeholder}
                            style={{ ...s.input(!!passwordErrors[field.name]), paddingRight: 40 }} />
                          <button type="button" onClick={() => field.setShow(!field.show)}
                            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}>
                            {field.show ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        {passwordErrors[field.name] && <p style={s.error}>{passwordErrors[field.name]}</p>}
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
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
            </div>

            {/* Back to chat + Logout */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, margin: '20px 0 40px' }}>
              <button
                onClick={e => { e.preventDefault(); navigate('/chat') }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px 28px', borderRadius: 999, border: 'none',
                  background: 'var(--color-primary)', color: '#fff',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.15s',
                  minWidth: 180,
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                ← {t('profile.backToChat')}
              </button>
              <Button variant="danger" style={{ borderRadius: 999, minWidth: 180, padding: '10px 28px' }} onClick={handleLogout} isLoading={loggingOut}>
                <LogOut size={16} /> {t('profile.logout')}
              </Button>
            </div>
          </>
        )}

        {/* ===== EDIT MODE ===== */}
        {isEditing && (
          <div style={{ marginTop: 28, paddingBottom: 40 }}>
            {/* Basic */}
            <div>
              <h3 style={s.sectionTitle}>{t('profile.personalInfo')}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={s.fieldLabel}><User size={14} /> {t('profile.fullName')}</label>
                  <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} placeholder={t('profile.fullNamePlaceholder')}
                    style={s.input(!!formErrors.fullName)} />
                  {formErrors.fullName && <p style={s.error}>{formErrors.fullName}</p>}
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  {renderEditField('bio', t('profile.bio'), <User size={14} />, 'textarea', t('profile.bioPlaceholder'))}
                </div>
                {renderEditField('birthday', t('profile.birthday'), <Cake size={14} />, 'date')}
                {renderEditField('gender', t('profile.gender'), <User size={14} />, 'select', '', [
                  { value: 'male', label: t('profile.genderMale') },
                  { value: 'female', label: t('profile.genderFemale') },
                  { value: 'other', label: t('profile.genderOther') },
                ])}
              </div>
            </div>

            <div style={s.divider} />

            {/* Contact */}
            <div>
              <h3 style={s.sectionTitle}>{t('profile.contactInfo')}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                {renderEditField('phone', t('profile.phone'), <Phone size={14} />, 'tel', t('profile.phonePlaceholder'))}
                {renderEditField('address', t('profile.address'), <MapPin size={14} />, 'text', t('profile.addressPlaceholder'))}
                <div style={{ gridColumn: '1 / -1' }}>
                  {renderEditField('hometown', t('profile.hometown'), <MapPin size={14} />, 'text', t('profile.hometownPlaceholder'))}
                </div>
              </div>
            </div>

            <div style={s.divider} />

            {/* Work & Education */}
            <div>
              <h3 style={s.sectionTitle}>{t('profile.workEducation')}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                {renderEditField('occupation', t('profile.occupation'), <Briefcase size={14} />, 'text', t('profile.occupationPlaceholder'))}
                {renderEditField('education', t('profile.education'), <GraduationCap size={14} />, 'text', t('profile.educationPlaceholder'))}
                <div style={{ gridColumn: '1 / -1' }}>
                  {renderEditField('hobbies', t('profile.hobbies'), <Heart size={14} />, 'text', t('profile.hobbiesPlaceholder'))}
                </div>
              </div>
            </div>

            {/* Save / Cancel */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 28 }}>
              <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 420 }}>
                <Button variant="primary" className="flex-1" onClick={handleSave} isLoading={saving}>
                  <Save size={16} /> {t('profile.save')}
                </Button>
                <Button variant="secondary" className="flex-1" onClick={cancelEditing} disabled={saving}>
                  <X size={16} /> {t('profile.cancel')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.open} title={confirmModal.title} message={confirmModal.message}
        onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal(prev => ({ ...prev, open: false }))}
        confirmText={t('profile.yes')} cancelText={t('profile.no')} danger={confirmModal.danger}
      />

      {/* Responsive: collapse grid to 1 col on mobile */}
      <style>{`
        @media (max-width: 640px) {
          [style*="grid-template-columns: repeat(2"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}

export default ProfilePage
