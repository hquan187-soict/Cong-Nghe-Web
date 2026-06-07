import { useState, useEffect } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { useLang } from '../context/LangContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import AuthLayout from '../components/layout/AuthLayout'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { authService } from '../services/auth.service'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(data, t) {
  const errs = {}
  if (!data.email.trim())
    errs.email = t('validation.required')
  else if (!EMAIL_REGEX.test(data.email))
    errs.email = t('validation.emailInvalid')

  if (!data.password)
    errs.password = t('validation.required')
  else if (data.password.length < 6)
    errs.password = t('validation.passwordMinLength')

  return errs
}

function LoginPage() {
  const { t } = useLang()
  const { user, login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  // Nếu đã đăng nhập → redirect về /chat
  if (user) {
    return <Navigate to="/chat" replace />
  }
  useEffect(() => {
    const purgedMsg = localStorage.getItem('account_purged_msg')
    if (purgedMsg) {
      localStorage.removeItem('account_purged_msg')
      toast.error(purgedMsg)
    }
  }, [])

  const [formData, setFormData] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({ email: '', password: '' })
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  function handleChange(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
    if (serverError) setServerError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const fieldErrors = validate(formData, t)
    if (Object.values(fieldErrors).some(Boolean)) {
      setErrors(fieldErrors)
      return
    }

    setLoading(true)
    try {
      const data = await authService.login(formData)
      // axios interceptor đã unwrap response.data
      // BE trả về: { _id, fullName, email, avatar, token }
      // Tách token ra khỏi user info rồi lưu vào AuthContext
      const { token: receivedToken, ...userInfo } = data
      login(userInfo, receivedToken)
      toast.success(t('login.success'))
      navigate('/chat', { replace: true })
    } catch (error) {
      toast.error(error.response?.data?.message || t('login.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title={t('login.title')} subtitle={t('login.subtitle')}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <Input
          label={t('login.email')}
          type="email"
          placeholder={t('login.emailPlaceholder')}
          value={formData.email}
          onChange={e => handleChange('email', e.target.value)}
          error={errors.email}
        />

        <div>
          <Input
            label={t('login.password')}
            type={showPassword ? 'text' : 'password'}
            placeholder={t('login.passwordPlaceholder')}
            value={formData.password}
            onChange={e => handleChange('password', e.target.value)}
            error={errors.password}
            icon={<Lock size={16} />}
            rightIcon={showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            onRightIconClick={() => setShowPassword(prev => !prev)}
          />
          <div className="flex justify-end mt-1.5">
            <Link
              to="/forgot-password"
              className="text-sm text-indigo-600 font-medium hover:text-indigo-700 hover:underline transition-colors"
            >
              {t('login.forgotPassword')}
            </Link>
          </div>
        </div>

        <Button type="submit" variant="primary" className="w-full mt-1" isLoading={loading}>
          {t('login.submit')}
        </Button>

        {serverError && (
          <p className="text-rose-500 text-sm font-medium text-center animate-in fade-in slide-in-from-top-1">
            {serverError}
          </p>
        )}
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        {t('login.noAccount')}{' '}
        <Link to="/register" className="text-indigo-600 font-semibold hover:underline">
          {t('login.registerLink')}
        </Link>
      </p>
    </AuthLayout>
  )
}

export default LoginPage
