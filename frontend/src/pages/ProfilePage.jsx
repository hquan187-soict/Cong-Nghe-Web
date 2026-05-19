import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Mail, User, Camera, Pencil, Save, X, Lock, Link, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useLang } from '../context/LangContext'
import { authService } from '../services/auth.service'
import { userService } from '../services/user.service'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'

function ProfilePage() {
  const { user, logout, updateUser } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const { t } = useLang()
  const [loggingOut, setLoggingOut] = useState(false)

  // --- Edit mode state ---
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    fullName: '',
    avatar: '',
  })
  const fileInputRef = useRef(null)
  const [formErrors, setFormErrors] = useState({})

  // --- Change password state ---
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

  // Bật edit mode — prefill form với dữ liệu hiện tại
  function startEditing() {
    setFormData({
      fullName: user?.fullName || '',
      avatar: user?.avatar || '',
    })
    setFormErrors({})
    setIsEditing(true)
  }

  // Huỷ edit mode
  function cancelEditing() {
    setIsEditing(false)
    setFormErrors({})
  }

  // Xử lý thay đổi input (profile)
  function handleChange(e) {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  // Xử lý thay đổi input (password)
  function handlePasswordChange(e) {
    const { name, value } = e.target
    setPasswordData((prev) => ({ ...prev, [name]: value }))
    if (passwordErrors[name]) {
      setPasswordErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  // Validate form profile
  function validateForm() {
    const errors = {}
    if (!formData.fullName.trim()) {
      errors.fullName = t('validation.required')
    }
    return errors
  }

  // Validate form password
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

  // Xử lý upload avatar (chỉ cập nhật URL)
  const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onloadend = async () => {
            const base64Image = reader.result;
            setFormData((prev) => ({ ...prev, avatar: base64Image }));
        };
    };

  // Gửi cập nhật profile (fullName, avatar)
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

  // Gửi đổi mật khẩu
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

  // Xử lý logout
  async function handleLogout() {
    setLoggingOut(true)
    try {
      await authService.logout()
    } catch (error) {
      console.warn('Logout API lỗi (bỏ qua):', error.message)
    }

    logout()
    toast.success(t('profile.logoutSuccess'))
    navigate('/login', { replace: true })
    setLoggingOut(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 sm:p-8 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply blur-3xl opacity-20 animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '3s' }}></div>

      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-slate-900/5 w-full max-w-md relative z-10 overflow-hidden">
        {/* Header gradient banner */}
        <div className="h-32 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 relative">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30"></div>

          {/* Nút chỉnh sửa ở góc trên phải */}
          {!isEditing && (
            <button
              onClick={startEditing}
              className="absolute top-4 right-4 p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-all duration-200 backdrop-blur-sm"
              title={t('profile.edit')}
            >
              <Pencil size={16} />
            </button>
          )}
        </div>

        {/* Avatar — positioned overlapping header */}
        <div className="flex justify-center -mt-14 relative z-10">
          <div className="relative group">
            <Avatar
              src={isEditing ? formData.avatar : user?.avatar}
              alt={user?.fullName || 'User'}
              size="lg"
              isOnline={user?.showActiveStatus !== false}
            />
            {isEditing && (
              <>
              <button onClick={() => fileInputRef.current.click()}>
              <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center cursor-pointer">
                <Camera size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              </button>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleImageUpload}
                className="hidden" />
              </>
            )}
          </div>
        </div>

        {/* User Info */}
        <div className="px-8 pt-4 pb-8">
          {/* Name */}
          <h1 className="text-2xl font-bold text-center text-slate-800 tracking-tight">
            {user?.fullName || t('profile.defaultName')}
          </h1>
          <p className="text-sm text-slate-500 text-center mt-1">
            {t('profile.title')}
          </p>

          {/* =========== CHẾ ĐỘ XEM (View Mode) =========== */}
          {!isEditing && (
            <>
              <div className="mt-6 space-y-3">
                {/* Full Name */}
                <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 transition-all duration-200 hover:border-indigo-200 hover:bg-indigo-50/30">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
                    <User size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                      {t('profile.fullName')}
                    </p>
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {user?.fullName || '—'}
                    </p>
                  </div>
                </div>

                {/* Email (chỉ xem, không sửa) */}
                <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 transition-all duration-200 hover:border-indigo-200 hover:bg-indigo-50/30">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 flex-shrink-0">
                    <Mail size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                      {t('profile.email')}
                    </p>
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {user?.email || '—'}
                    </p>
                  </div>
                </div>

                {/* Avatar URL (nếu có) */}
                {user?.avatar && (
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 transition-all duration-200 hover:border-indigo-200 hover:bg-indigo-50/30">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                      <Link size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                        {t('profile.avatarUrl')}
                      </p>
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {user.avatar}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* --- Đổi mật khẩu --- */}
              <div className="mt-6">
                {!showPasswordSection ? (
                  <button
                    onClick={() => setShowPasswordSection(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200"
                  >
                    <Lock size={16} />
                    {t('profile.changePassword')}
                  </button>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Lock size={14} />
                      {t('profile.changePassword')}
                    </h3>

                    {/* Mật khẩu hiện tại */}
                    <div>
                      <label className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1 block">
                        {t('profile.currentPassword')}
                      </label>
                      <div className="relative">
                        <input
                          type={showCurrentPw ? 'text' : 'password'}
                          name="currentPassword"
                          value={passwordData.currentPassword}
                          onChange={handlePasswordChange}
                          className={`w-full px-4 py-2.5 pr-10 rounded-xl border bg-white text-sm text-slate-800 placeholder-slate-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 ${
                            passwordErrors.currentPassword ? 'border-rose-400 ring-2 ring-rose-400/30' : 'border-slate-200 hover:border-slate-300'
                          }`}
                          placeholder={t('profile.currentPasswordPlaceholder')}
                        />
                        <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {passwordErrors.currentPassword && (
                        <p className="mt-1 text-xs text-rose-500">{passwordErrors.currentPassword}</p>
                      )}
                    </div>

                    {/* Mật khẩu mới */}
                    <div>
                      <label className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1 block">
                        {t('profile.newPassword')}
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPw ? 'text' : 'password'}
                          name="newPassword"
                          value={passwordData.newPassword}
                          onChange={handlePasswordChange}
                          className={`w-full px-4 py-2.5 pr-10 rounded-xl border bg-white text-sm text-slate-800 placeholder-slate-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 ${
                            passwordErrors.newPassword ? 'border-rose-400 ring-2 ring-rose-400/30' : 'border-slate-200 hover:border-slate-300'
                          }`}
                          placeholder={t('profile.newPasswordPlaceholder')}
                        />
                        <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {passwordErrors.newPassword && (
                        <p className="mt-1 text-xs text-rose-500">{passwordErrors.newPassword}</p>
                      )}
                    </div>

                    {/* Xác nhận mật khẩu mới */}
                    <div>
                      <label className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1 block">
                        {t('profile.confirmNewPassword')}
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPw ? 'text' : 'password'}
                          name="confirmPassword"
                          value={passwordData.confirmPassword}
                          onChange={handlePasswordChange}
                          className={`w-full px-4 py-2.5 pr-10 rounded-xl border bg-white text-sm text-slate-800 placeholder-slate-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 ${
                            passwordErrors.confirmPassword ? 'border-rose-400 ring-2 ring-rose-400/30' : 'border-slate-200 hover:border-slate-300'
                          }`}
                          placeholder={t('profile.confirmNewPasswordPlaceholder')}
                        />
                        <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {passwordErrors.confirmPassword && (
                        <p className="mt-1 text-xs text-rose-500">{passwordErrors.confirmPassword}</p>
                      )}
                    </div>

                    {/* Nút Đổi mật khẩu + Huỷ */}
                    <div className="flex gap-3 pt-1">
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

              {/* Logout button */}
              <div className="mt-6">
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

          {/* =========== CHẾ ĐỘ CHỈNH SỬA (Edit Mode) =========== */}
          {isEditing && (
            <div className="mt-6 space-y-4">
              {/* Full Name */}
              <div>
                <label className="flex items-center gap-2 text-xs text-slate-500 font-medium uppercase tracking-wider mb-1.5">
                  <User size={14} />
                  {t('profile.fullName')}
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className={`w-full px-4 py-2.5 rounded-xl border bg-white text-sm text-slate-800 placeholder-slate-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 ${
                    formErrors.fullName ? 'border-rose-400 ring-2 ring-rose-400/30' : 'border-slate-200 hover:border-slate-300'
                  }`}
                  placeholder={t('profile.fullNamePlaceholder')}
                />
                {formErrors.fullName && (
                  <p className="mt-1 text-xs text-rose-500">{formErrors.fullName}</p>
                )}
              </div>

              {/* Nút Lưu + Huỷ */}
              <div className="flex gap-3 pt-2">
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

          {/* Back to chat link */}
          <p className="text-center text-sm text-slate-500 mt-4">
            <a
              href="/chat"
              onClick={(e) => { e.preventDefault(); navigate('/chat') }}
              className="text-indigo-600 font-semibold hover:underline inline-flex items-center gap-1"
            >
              ← {t('profile.backToChat')}
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage
