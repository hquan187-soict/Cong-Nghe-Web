import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Mail, User, Camera, Pencil, Save, X, Lock, Link, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useLang } from '../context/LangContext'
import { authService } from '../services/auth.service'
import { userService } from '../services/user.service'
import Avatar from './ui/Avatar'
import Button from './ui/Button'

function ProfileModal({ isOpen, onClose }) {
  const { user, logout, updateUser } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const { t } = useLang()
  const [loggingOut, setLoggingOut] = useState(false)

  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    fullName: '',
    avatar: '',
  })
  const fileInputRef = useRef(null)
  const [formErrors, setFormErrors] = useState({})

  const [showPasswordSection, setShowPasswordSection] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [passwordErrors, setPasswordErrors] = useState({})
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)

  if (!isOpen) return null

  function startEditing() {
    setFormData({
      fullName: user?.fullName || '',
      avatar: user?.avatar || '',
    })
    setFormErrors({})
    setIsEditing(true)
  }

  function cancelEditing() {
    setIsEditing(false)
    setFormErrors({})
  }

  function handleChange(e) {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  function handlePasswordChange(e) {
    const { name, value } = e.target
    setPasswordData((prev) => ({ ...prev, [name]: value }))
    if (passwordErrors[name]) {
      setPasswordErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  function validateForm() {
    const errors = {}
    if (!formData.fullName.trim()) {
      errors.fullName = t('validation.required')
    }
    return errors
  }

  function validatePassword() {
    const errors = {}
    if (!passwordData.currentPassword) {
      errors.currentPassword = t('validation.required')
    }
    if (!passwordData.newPassword) {
      errors.newPassword = t('validation.required')
    } else if (passwordData.newPassword.length < 6) {
      errors.newPassword = t('validation.passwordMinLength')
    }
    if (!passwordData.confirmPassword) {
      errors.confirmPassword = t('validation.required')
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = t('validation.passwordMismatch')
    }
    return errors
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onloadend = async () => {
      const base64Image = reader.result
      setFormData((prev) => ({ ...prev, avatar: base64Image }))
    }
  }

  async function handleSave() {
    const errors = validateForm()
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setSaving(true)
    try {
      const payload = {}
      if (formData.fullName.trim() !== (user?.fullName || '')) {
        payload.fullName = formData.fullName.trim()
      }
      if (formData.avatar && formData.avatar !== user?.avatar) {
        payload.avatar = formData.avatar
      }
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
      const msg = error.response?.data?.message || error.message || t('profile.updateError')
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword() {
    const errors = validatePassword()
    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors)
      return
    }

    setChangingPassword(true)
    try {
      await userService.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      })
      toast.success(t('profile.passwordChangeSuccess'))
      setShowPasswordSection(false)
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPasswordErrors({})
    } catch (error) {
      const msg = error.response?.data?.message || error.message || t('profile.passwordChangeError')
      toast.error(msg)
    } finally {
      setChangingPassword(false)
    }
  }

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await authService.logout()
    } catch (error) {
      console.warn('Logout API error:', error.message)
    }
    logout()
    toast.success(t('profile.logoutSuccess'))
    navigate('/login', { replace: true })
    setLoggingOut(false)
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="profile-modal__overlay" onClick={handleOverlayClick}>
      <div className="profile-modal">
        <button className="profile-modal__close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="profile-modal__banner">
          <div className="profile-modal__banner-pattern"></div>
          {!isEditing && (
            <button
              onClick={startEditing}
              className="profile-modal__edit-btn"
              title={t('profile.edit')}
            >
              <Pencil size={16} />
            </button>
          )}
        </div>

        <div className="profile-modal__avatar-wrapper">
          <div className="profile-modal__avatar-group">
            <Avatar
              src={isEditing ? formData.avatar : user?.avatar}
              alt={user?.fullName || 'User'}
              size="lg"
              isOnline={true}
            />
            {isEditing && (
              <>
                <button className="profile-modal__camera-btn" onClick={() => fileInputRef.current.click()}>
                  <Camera size={18} />
                </button>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
              </>
            )}
          </div>
        </div>

        <div className="profile-modal__body">
          <h2 className="profile-modal__name">
            {user?.fullName || t('profile.defaultName')}
          </h2>
          <p className="profile-modal__subtitle">{t('profile.title')}</p>

          {!isEditing && (
            <>
              <div className="profile-modal__info-list">
                <div className="profile-modal__info-item">
                  <div className="profile-modal__info-icon profile-modal__info-icon--indigo">
                    <User size={18} />
                  </div>
                  <div className="profile-modal__info-content">
                    <span className="profile-modal__info-label">{t('profile.fullName')}</span>
                    <span className="profile-modal__info-value">{user?.fullName || '—'}</span>
                  </div>
                </div>

                <div className="profile-modal__info-item">
                  <div className="profile-modal__info-icon profile-modal__info-icon--purple">
                    <Mail size={18} />
                  </div>
                  <div className="profile-modal__info-content">
                    <span className="profile-modal__info-label">{t('profile.email')}</span>
                    <span className="profile-modal__info-value">{user?.email || '—'}</span>
                  </div>
                </div>

                {user?.avatar && (
                  <div className="profile-modal__info-item">
                    <div className="profile-modal__info-icon profile-modal__info-icon--emerald">
                      <Link size={18} />
                    </div>
                    <div className="profile-modal__info-content">
                      <span className="profile-modal__info-label">{t('profile.avatarUrl')}</span>
                      <span className="profile-modal__info-value profile-modal__info-value--truncate">{user.avatar}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="profile-modal__password-section">
                {!showPasswordSection ? (
                  <button
                    onClick={() => setShowPasswordSection(true)}
                    className="profile-modal__password-toggle"
                  >
                    <Lock size={16} />
                    {t('profile.changePassword')}
                  </button>
                ) : (
                  <div className="profile-modal__password-form">
                    <h3 className="profile-modal__password-title">
                      <Lock size={14} />
                      {t('profile.changePassword')}
                    </h3>

                    <div className="profile-modal__field">
                      <label>{t('profile.currentPassword')}</label>
                      <div className="profile-modal__input-wrapper">
                        <input
                          type={showCurrentPw ? 'text' : 'password'}
                          name="currentPassword"
                          value={passwordData.currentPassword}
                          onChange={handlePasswordChange}
                          className={`profile-modal__input ${passwordErrors.currentPassword ? 'profile-modal__input--error' : ''}`}
                          placeholder={t('profile.currentPasswordPlaceholder')}
                        />
                        <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="profile-modal__eye-btn">
                          {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {passwordErrors.currentPassword && (
                        <p className="profile-modal__error">{passwordErrors.currentPassword}</p>
                      )}
                    </div>

                    <div className="profile-modal__field">
                      <label>{t('profile.newPassword')}</label>
                      <div className="profile-modal__input-wrapper">
                        <input
                          type={showNewPw ? 'text' : 'password'}
                          name="newPassword"
                          value={passwordData.newPassword}
                          onChange={handlePasswordChange}
                          className={`profile-modal__input ${passwordErrors.newPassword ? 'profile-modal__input--error' : ''}`}
                          placeholder={t('profile.newPasswordPlaceholder')}
                        />
                        <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="profile-modal__eye-btn">
                          {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {passwordErrors.newPassword && (
                        <p className="profile-modal__error">{passwordErrors.newPassword}</p>
                      )}
                    </div>

                    <div className="profile-modal__field">
                      <label>{t('profile.confirmNewPassword')}</label>
                      <div className="profile-modal__input-wrapper">
                        <input
                          type={showConfirmPw ? 'text' : 'password'}
                          name="confirmPassword"
                          value={passwordData.confirmPassword}
                          onChange={handlePasswordChange}
                          className={`profile-modal__input ${passwordErrors.confirmPassword ? 'profile-modal__input--error' : ''}`}
                          placeholder={t('profile.confirmNewPasswordPlaceholder')}
                        />
                        <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="profile-modal__eye-btn">
                          {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {passwordErrors.confirmPassword && (
                        <p className="profile-modal__error">{passwordErrors.confirmPassword}</p>
                      )}
                    </div>

                    <div className="profile-modal__btn-row">
                      <Button
                        variant="primary"
                        className="flex-1 !text-sm !py-2"
                        onClick={handleChangePassword}
                        isLoading={changingPassword}
                      >
                        <Save size={14} />
                        {t('profile.save')}
                      </Button>
                      <Button
                        variant="secondary"
                        className="flex-1 !text-sm !py-2"
                        onClick={() => {
                          setShowPasswordSection(false)
                          setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
                          setPasswordErrors({})
                        }}
                        disabled={changingPassword}
                      >
                        <X size={14} />
                        {t('profile.cancel')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="profile-modal__logout">
                <Button
                  variant="danger"
                  className="w-full"
                  onClick={handleLogout}
                  isLoading={loggingOut}
                >
                  <LogOut size={18} />
                  {t('profile.logout')}
                </Button>
              </div>
            </>
          )}

          {isEditing && (
            <div className="profile-modal__edit-form">
              <div className="profile-modal__field">
                <label>
                  <User size={14} />
                  {t('profile.fullName')}
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className={`profile-modal__input ${formErrors.fullName ? 'profile-modal__input--error' : ''}`}
                  placeholder={t('profile.fullNamePlaceholder')}
                />
                {formErrors.fullName && (
                  <p className="profile-modal__error">{formErrors.fullName}</p>
                )}
              </div>

              <div className="profile-modal__btn-row">
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleSave}
                  isLoading={saving}
                >
                  <Save size={16} />
                  {t('profile.save')}
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={cancelEditing}
                  disabled={saving}
                >
                  <X size={16} />
                  {t('profile.cancel')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProfileModal
