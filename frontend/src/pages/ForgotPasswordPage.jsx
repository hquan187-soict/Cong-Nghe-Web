import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowLeft } from 'lucide-react'
import { useLang } from '../context/LangContext'
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

  if (!data.otp.trim())
    errs.otp = t('validation.required')

  if (!data.newPassword)
    errs.newPassword = t('validation.required')
  else if (data.newPassword.length < 6)
    errs.newPassword = t('validation.passwordMinLength')

  if (!data.confirmPassword)
    errs.confirmPassword = t('validation.required')
  else if (data.confirmPassword !== data.newPassword)
    errs.confirmPassword = t('validation.passwordMismatch')

  return errs
}

function ForgotPasswordPage() {
  const { t } = useLang()
  const toast = useToast()
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    email: '', otp: '', newPassword: '', confirmPassword: ''
  })
  const [errors, setErrors] = useState({
    email: '', otp: '', newPassword: '', confirmPassword: ''
  })
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [otpCooldown, setOtpCooldown] = useState(0)

  function handleChange(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  async function handleSendOtp() {
    if (!formData.email.trim()) {
      setErrors(prev => ({ ...prev, email: t('validation.required') }))
      return
    }
    if (!EMAIL_REGEX.test(formData.email)) {
      setErrors(prev => ({ ...prev, email: t('validation.emailInvalid') }))
      return
    }

    setSendingOtp(true)
    try {
      await authService.sendForgotPasswordOtp({ email: formData.email })
      toast.success(t('forgotPassword.otpSent'))

      setOtpCooldown(60)
      const interval = setInterval(() => {
        setOtpCooldown(prev => {
          if (prev <= 1) {
            clearInterval(interval)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (error) {
      toast.error(error.response?.data?.message || t('forgotPassword.otpError'))
    } finally {
      setSendingOtp(false)
    }
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
      await authService.resetPassword({
        email: formData.email,
        otp: formData.otp,
        newPassword: formData.newPassword,
      })
      toast.success(t('forgotPassword.success'))
      navigate('/login', { replace: true })
    } catch (error) {
      toast.error(error.response?.data?.message || t('forgotPassword.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title={t('forgotPassword.title')}
      subtitle={t('forgotPassword.subtitle')}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {/* Email */}
        <Input
          label={t('forgotPassword.email')}
          type="email"
          placeholder={t('forgotPassword.emailPlaceholder')}
          value={formData.email}
          onChange={e => handleChange('email', e.target.value)}
          error={errors.email}
          icon={<Mail size={16} />}
        />

        {/* OTP — input + nút Nhận OTP */}
        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
            {t('forgotPassword.otpLabel')}
          </label>
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                type="text"
                placeholder={t('forgotPassword.otpPlaceholder')}
                value={formData.otp}
                onChange={e => handleChange('otp', e.target.value)}
                error={errors.otp}
                icon={<ShieldCheck size={16} />}
                maxLength={6}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              className="shrink-0 !px-4 !py-2.5 self-start"
              onClick={handleSendOtp}
              isLoading={sendingOtp}
              disabled={sendingOtp || otpCooldown > 0}
            >
              {otpCooldown > 0
                ? `${otpCooldown}s`
                : t('forgotPassword.sendOtp')
              }
            </Button>
          </div>
        </div>

        {/* Mật khẩu mới */}
        <Input
          label={t('forgotPassword.newPassword')}
          type={showNewPassword ? 'text' : 'password'}
          placeholder={t('forgotPassword.newPasswordPlaceholder')}
          value={formData.newPassword}
          onChange={e => handleChange('newPassword', e.target.value)}
          error={errors.newPassword}
          icon={<Lock size={16} />}
          rightIcon={showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          onRightIconClick={() => setShowNewPassword(prev => !prev)}
        />

        {/* Xác nhận mật khẩu mới */}
        <Input
          label={t('forgotPassword.confirmPassword')}
          type={showConfirm ? 'text' : 'password'}
          placeholder={t('forgotPassword.confirmPasswordPlaceholder')}
          value={formData.confirmPassword}
          onChange={e => handleChange('confirmPassword', e.target.value)}
          error={errors.confirmPassword}
          icon={<Lock size={16} />}
          rightIcon={showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
          onRightIconClick={() => setShowConfirm(prev => !prev)}
        />

        {/* Nút Đặt lại mật khẩu */}
        <Button type="submit" variant="primary" className="w-full mt-1" isLoading={loading}>
          {t('forgotPassword.submit')}
        </Button>
      </form>

      {/* Quay lại Đăng nhập */}
      <p className="text-center text-sm text-slate-500 mt-6">
        <Link
          to="/login"
          className="text-indigo-600 font-semibold hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft size={14} />
          {t('forgotPassword.backToLogin')}
        </Link>
      </p>
    </AuthLayout>
  )
}

export default ForgotPasswordPage
