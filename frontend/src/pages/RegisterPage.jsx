import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { useLang } from '../context/LangContext'
import AuthLayout from '../components/layout/AuthLayout'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { authService } from '../services/auth.service'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(data, t) {
  const errs = {}
  if (!data.fullName.trim())
    errs.fullName = t('validation.required')

  if (!data.email.trim())
    errs.email = t('validation.required')
  else if (!EMAIL_REGEX.test(data.email))
    errs.email = t('validation.emailInvalid')

  if (!data.password)
    errs.password = t('validation.required')
  else if (data.password.length < 6)
    errs.password = t('validation.passwordMinLength')

  if (!data.confirmPassword)
    errs.confirmPassword = t('validation.required')
  else if (data.confirmPassword !== data.password)
    errs.confirmPassword = t('validation.passwordMismatch')

  return errs
}

function RegisterPage() {
  const { t } = useLang()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({ fullName: '', email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState({ fullName: '', email: '', password: '', confirmPassword: '' })
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
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
      const { fullName, email, password } = formData
      await authService.signup({ fullName, email, password })
      navigate('/login', { replace: true })
    } catch (error) {
      const status = error.response?.status
      const message = error.response?.data?.message || 'Đăng ký thất bại'
      if (status === 409) {
        setErrors(prev => ({ ...prev, email: message }))
      } else {
        setServerError(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title={t('register.title')} subtitle={t('register.subtitle')}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <Input
          label={t('register.fullName') || 'Họ và tên'}
          type="text"
          placeholder={t('register.fullNamePlaceholder') || 'Nhập họ và tên'}
          value={formData.fullName}
          onChange={e => handleChange('fullName', e.target.value)}
          error={errors.fullName}
        />

        <Input
          label={t('register.email')}
          type="email"
          placeholder={t('register.emailPlaceholder')}
          value={formData.email}
          onChange={e => handleChange('email', e.target.value)}
          error={errors.email}
        />

        <Input
          label={t('register.password')}
          type={showPassword ? 'text' : 'password'}
          placeholder={t('register.passwordPlaceholder')}
          value={formData.password}
          onChange={e => handleChange('password', e.target.value)}
          error={errors.password}
          icon={<Lock size={16} />}
          rightIcon={showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          onRightIconClick={() => setShowPassword(prev => !prev)}
        />

        <Input
          label={t('register.confirmPassword')}
          type={showConfirm ? 'text' : 'password'}
          placeholder={t('register.confirmPasswordPlaceholder')}
          value={formData.confirmPassword}
          onChange={e => handleChange('confirmPassword', e.target.value)}
          error={errors.confirmPassword}
          icon={<Lock size={16} />}
          rightIcon={showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
          onRightIconClick={() => setShowConfirm(prev => !prev)}
        />

        <Button type="submit" variant="primary" className="w-full mt-1" loading={loading}>
          {t('register.submit')}
        </Button>

        {serverError && (
          <p className="text-rose-500 text-sm font-medium text-center animate-in fade-in slide-in-from-top-1">
            {serverError}
          </p>
        )}
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        {t('register.hasAccount')}{' '}
        <Link to="/login" className="text-indigo-600 font-semibold hover:underline">
          {t('register.loginLink')}
        </Link>
      </p>
    </AuthLayout>
  )
}

export default RegisterPage
