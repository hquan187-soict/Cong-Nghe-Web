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
  const [formData, setFormData] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)

  function handleChange(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  function handleBlur(field) {
    const fieldErrors = validate(formData, t)
    setErrors(prev => ({ ...prev, [field]: fieldErrors[field] ?? '' }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const fieldErrors = validate(formData, t)
    if (Object.values(fieldErrors).some(Boolean)) {
      setErrors(fieldErrors)
      return
    }
    console.log('Login data:', formData)
    alert('Sẽ gọi API sau')
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
          onBlur={() => handleBlur('email')}
          error={errors.email}
        />

        <Input
          label={t('login.password')}
          type={showPassword ? 'text' : 'password'}
          placeholder={t('login.passwordPlaceholder')}
          value={formData.password}
          onChange={e => handleChange('password', e.target.value)}
          onBlur={() => handleBlur('password')}
          error={errors.password}
          icon={<Lock size={16} />}
          rightIcon={showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          onRightIconClick={() => setShowPassword(prev => !prev)}
        />

        <Button type="submit" variant="primary" className="w-full mt-1">
          {t('login.submit')}
        </Button>
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
