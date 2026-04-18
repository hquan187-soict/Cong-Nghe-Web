import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { useLang } from '../context/LangContext'
import AuthLayout from '../components/layout/AuthLayout'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(data, t) {
  const errs = {}
  if (!data.username.trim())
    errs.username = t('validation.required')

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
  const [formData, setFormData] = useState({ username: '', email: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState({ username: '', email: '', password: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  function handleChange(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const fieldErrors = validate(formData, t)
    if (Object.values(fieldErrors).some(Boolean)) {
      setErrors(fieldErrors)
      return
    }
    console.log('Register data:', formData)
    alert('Sẽ gọi API sau')
  }

  return (
    <AuthLayout title={t('register.title')} subtitle={t('register.subtitle')}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <Input
          label={t('register.username')}
          type="text"
          placeholder={t('register.usernamePlaceholder')}
          value={formData.username}
          onChange={e => handleChange('username', e.target.value)}
          error={errors.username}
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

        <Button type="submit" variant="primary" className="w-full mt-1">
          {t('register.submit')}
        </Button>
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
