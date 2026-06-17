import { useState, useRef } from 'react'
import { Navigate, useNavigate, useLocation } from 'react-router-dom'
import ReCAPTCHA from 'react-google-recaptcha'
import { Lock, Eye, EyeOff, Mail, ShieldCheck, ArrowLeft, Shield, Gauge } from 'lucide-react'
import { useLang } from '../context/LangContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { GoogleLogin } from '@react-oauth/google'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { authService } from '../services/auth.service'
import { triggerWarningPopup } from '../components/WarningPopup'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function CardHeader({ title, subtitle }) {
  return (
    <div className="mb-8 text-center">
      <img src="/logo.png" alt="Logo" className="w-16 h-16 rounded-2xl mx-auto mb-4 shadow-lg shadow-indigo-500/30" />
      <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{title}</h2>
      <p className="text-slate-500 mt-2 text-sm">{subtitle}</p>
    </div>
  )
}

// ─── Login Form ────────────────────────────────────────
function LoginForm({ onNavigate }) {
  const { t } = useLang()
  const { login, loginWithGoogle } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [formData, setFormData] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({ email: '', password: '' })
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [requiresCaptcha, setRequiresCaptcha] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const recaptchaRef = useRef(null)

  function handleChange(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
    if (serverError) setServerError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = {}
    if (!formData.email.trim()) errs.email = t('validation.required')
    else if (!EMAIL_REGEX.test(formData.email)) errs.email = t('validation.emailInvalid')
    if (!formData.password) errs.password = t('validation.required')
    else if (formData.password.length < 6) errs.password = t('validation.passwordMinLength')
    if (Object.values(errs).some(Boolean)) { setErrors(errs); return }
    if (requiresCaptcha && !captchaToken) {
      toast.error("Vui lòng xác minh bạn không phải là robot")
      return
    }

    document.activeElement?.blur?.()
    setLoading(true)
    try {
      const data = await authService.login({ ...formData, captchaToken })
      const { token: receivedToken, hasWarning, ...userInfo } = data
      login(userInfo, receivedToken)
      if (hasWarning) {
        triggerWarningPopup()
      } else {
        toast.success(t('login.success'))
      }
      navigate(userInfo.role === 'admin' ? '/admin' : '/chat', { replace: true })
    } catch (error) {
      if (error.response?.data?.requiresCaptcha) {
        setRequiresCaptcha(true)
      }
      const status = error.response?.status
      const message = error.response?.data?.message || t('login.error')
      if (message.includes('truonghoangquan18072005@gmail.com')) {
        setServerError(message)
      } else {
        toast.error(message)
      }
      if (recaptchaRef.current) recaptchaRef.current.reset()
      setCaptchaToken('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <CardHeader title={t('login.title')} subtitle={t('login.subtitle')} />

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
            <button
              type="button"
              onClick={() => onNavigate('forgot-password')}
              className="text-sm text-indigo-600 font-medium hover:text-indigo-700 hover:underline transition-colors"
            >
              {t('login.forgotPassword')}
            </button>
          </div>
        </div>

        <Button type="submit" variant="primary" className="w-full mt-1" isLoading={loading}>
          {t('login.submit')}
        </Button>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-slate-500">Hoặc</span>
          </div>
        </div>


        <div className="flex justify-center w-full [&_iframe]:!rounded-xl [&>div]:!rounded-xl overflow-hidden">
          <GoogleLogin
            onSuccess={async (credentialResponse) => {
              setGoogleLoading(true);
              try {
                const data = await loginWithGoogle(credentialResponse.credential);
                if (data?.hasWarning) {
                  triggerWarningPopup();
                } else {
                  toast.success(t('login.success') || 'Đăng nhập thành công');
                }
                const role = data?.role || 'user';
                navigate(role === 'admin' ? '/admin' : '/chat', { replace: true });
              } catch (error) {
                const status = error.response?.status;
                const message = error.response?.data?.message || 'Đăng nhập Google thất bại';
                if (message.includes('truonghoangquan18072005@gmail.com')) {
                  setServerError(message);
                } else {
                  toast.error(message);
                }
              } finally {
                setGoogleLoading(false);
              }
            }}
            onError={() => {
              console.log('Login Failed');
              toast.error('Đăng nhập Google thất bại!');
            }}
            shape="pill"
            size="large"
            width="320"
            theme="outline"
            text="signin_with"
            logo_alignment="left"
          />
        </div>

        {requiresCaptcha && (
          <div className="flex justify-center mt-2">
            <ReCAPTCHA
              ref={recaptchaRef}
              sitekey="6LdBSSQtAAAAAE34vUaSzt54bgJ5lPbBm2c13yT-"
              onChange={(token) => {
                setCaptchaToken(token)
                setServerError('')
              }}
            />
          </div>
        )}

        {serverError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mt-2">
            <p className="text-red-600 text-sm font-medium text-center">
              {serverError.includes('truonghoangquan18072005@gmail.com')
                ? <>
                    {serverError.split('truonghoangquan18072005@gmail.com')[0]}
                    <a href="https://mail.google.com/mail/?view=cm&to=truonghoangquan18072005@gmail.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-bold">truonghoangquan18072005@gmail.com</a>
                  </>
                : serverError
              }
            </p>
          </div>
        )}
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        {t('login.noAccount')}{' '}
        <button
          type="button"
          onClick={() => onNavigate('register')}
          className="text-indigo-600 font-semibold hover:underline"
        >
          {t('login.registerLink')}
        </button>
      </p>

    </>
  )
}

// ─── Register Form ─────────────────────────────────────
function RegisterForm({ onNavigate }) {
  const { t } = useLang()
  const toast = useToast()

  const [formData, setFormData] = useState({
    fullName: '', email: '', otp: '', password: '', confirmPassword: ''
  })
  const [errors, setErrors] = useState({
    fullName: '', email: '', otp: '', password: '', confirmPassword: ''
  })
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [otpCooldown, setOtpCooldown] = useState(0)
  const { loginWithGoogle } = useAuth()
  const navigate = useNavigate()



  function handleChange(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
    if (serverError) setServerError('')
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
      await authService.sendSignupOtp({ email: formData.email, type: 'verify' })
      toast.success(t('register.otpSent'))
      setOtpCooldown(60)
      const interval = setInterval(() => {
        setOtpCooldown(prev => {
          if (prev <= 1) { clearInterval(interval); return 0 }
          return prev - 1
        })
      }, 1000)
    } catch (error) {
      toast.error(error.response?.data?.message || t('register.otpError'))
    } finally {
      setSendingOtp(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = {}
    if (!formData.fullName.trim()) errs.fullName = t('validation.required')
    if (!formData.email.trim()) errs.email = t('validation.required')
    else if (!EMAIL_REGEX.test(formData.email)) errs.email = t('validation.emailInvalid')
    if (!formData.otp.trim()) errs.otp = t('validation.required')
    if (!formData.password) errs.password = t('validation.required')
    else if (formData.password.length < 6) errs.password = t('validation.passwordMinLength')
    if (!formData.confirmPassword) errs.confirmPassword = t('validation.required')
    else if (formData.confirmPassword !== formData.password) errs.confirmPassword = t('validation.passwordMismatch')
    if (Object.values(errs).some(Boolean)) { setErrors(errs); return }

    setLoading(true)
    try {
      const { fullName, email, password, otp } = formData
      await authService.signup({ fullName, email, password, otp })
      toast.success(t('register.success'))
      onNavigate('login')
    } catch (error) {
      const status = error.response?.status
      const message = error.response?.data?.message || t('register.error')
      if (status === 409) {
        setErrors(prev => ({ ...prev, email: message }))
      } else {
        toast.error(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <CardHeader title={t('register.title')} subtitle={t('register.subtitle')} />

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <Input
          label={t('register.fullName') || 'Full Name'}
          type="text"
          placeholder={t('register.fullNamePlaceholder') || 'Enter your full name'}
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
        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">
            {t('register.otpLabel')}
          </label>
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                type="text"
                placeholder={t('register.otpPlaceholder')}
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
              {otpCooldown > 0 ? `${otpCooldown}s` : t('register.sendOtp')}
            </Button>
          </div>
        </div>
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

        <Button type="submit" variant="primary" className="w-full mt-1" isLoading={loading}>
          {t('register.submit')}
        </Button>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-slate-500">Hoặc</span>
          </div>
        </div>


        <div className="flex justify-center w-full [&_iframe]:!rounded-xl [&>div]:!rounded-xl overflow-hidden">
          <GoogleLogin
            onSuccess={async (credentialResponse) => {
              setGoogleLoading(true);
              try {
                const data = await loginWithGoogle(credentialResponse.credential);
                if (data?.hasWarning) {
                  triggerWarningPopup();
                } else {
                  toast.success(t('login.success') || 'Đăng nhập thành công');
                }
                const role = data?.role || 'user';
                navigate(role === 'admin' ? '/admin' : '/chat', { replace: true });
              } catch (error) {
                const status = error.response?.status;
                const message = error.response?.data?.message || 'Đăng nhập Google thất bại';
                if (message.includes('truonghoangquan18072005@gmail.com')) {
                  setServerError(message);
                } else {
                  toast.error(message);
                }
              } finally {
                setGoogleLoading(false);
              }
            }}
            onError={() => {
              console.log('Login Failed');
              toast.error('Đăng nhập Google thất bại!');
            }}
            shape="pill"
            size="large"
            width="320"
            theme="outline"
            text="signup_with"
            logo_alignment="left"
          />
        </div>

        {serverError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mt-2">
            <p className="text-red-600 text-sm font-medium text-center">
              {serverError.includes('truonghoangquan18072005@gmail.com')
                ? <>
                    {serverError.split('truonghoangquan18072005@gmail.com')[0]}
                    <a href="https://mail.google.com/mail/?view=cm&to=truonghoangquan18072005@gmail.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline font-bold">truonghoangquan18072005@gmail.com</a>
                  </>
                : serverError
              }
            </p>
          </div>
        )}
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        {t('register.hasAccount')}{' '}
        <button
          type="button"
          onClick={() => onNavigate('login')}
          className="text-indigo-600 font-semibold hover:underline"
        >
          {t('register.loginLink')}
        </button>
      </p>

    </>
  )
}

// ─── Forgot Password Form ──────────────────────────────
function ForgotPasswordForm({ onNavigate }) {
  const { t } = useLang()
  const toast = useToast()

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
      await authService.sendForgotPasswordOtp({ email: formData.email, type: "reset" })
      toast.success(t('forgotPassword.otpSent'))
      setOtpCooldown(60)
      const interval = setInterval(() => {
        setOtpCooldown(prev => {
          if (prev <= 1) { clearInterval(interval); return 0 }
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
    const errs = {}
    if (!formData.email.trim()) errs.email = t('validation.required')
    else if (!EMAIL_REGEX.test(formData.email)) errs.email = t('validation.emailInvalid')
    if (!formData.otp.trim()) errs.otp = t('validation.required')
    if (!formData.newPassword) errs.newPassword = t('validation.required')
    else if (formData.newPassword.length < 6) errs.newPassword = t('validation.passwordMinLength')
    if (!formData.confirmPassword) errs.confirmPassword = t('validation.required')
    else if (formData.confirmPassword !== formData.newPassword) errs.confirmPassword = t('validation.passwordMismatch')
    if (Object.values(errs).some(Boolean)) { setErrors(errs); return }

    setLoading(true)
    try {
      await authService.resetPassword({
        email: formData.email,
        otp: formData.otp,
        newPassword: formData.newPassword,
      })
      toast.success(t('forgotPassword.success'))
      onNavigate('login')
    } catch (error) {
      toast.error(error.response?.data?.message || t('forgotPassword.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <CardHeader title={t('forgotPassword.title')} subtitle={t('forgotPassword.subtitle')} />

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <Input
          label={t('forgotPassword.email')}
          type="email"
          placeholder={t('forgotPassword.emailPlaceholder')}
          value={formData.email}
          onChange={e => handleChange('email', e.target.value)}
          error={errors.email}
          icon={<Mail size={16} />}
        />
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
              {otpCooldown > 0 ? `${otpCooldown}s` : t('forgotPassword.sendOtp')}
            </Button>
          </div>
        </div>
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

        <Button type="submit" variant="primary" className="w-full mt-1" isLoading={loading}>
          {t('forgotPassword.submit')}
        </Button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        <button
          type="button"
          onClick={() => onNavigate('login')}
          className="text-indigo-600 font-semibold hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft size={14} />
          {t('forgotPassword.backToLogin')}
        </button>
      </p>
    </>
  )
}

// ─── Main AuthPage with Flip Animation ─────────────────
function AuthPage() {
  const { user } = useAuth()
  const { t } = useLang()
  const location = useLocation()
  const navigate = useNavigate()

  const initialView = location.pathname === '/register'
    ? 'register'
    : location.pathname === '/forgot-password'
      ? 'forgot-password'
      : 'login'

  const [activeView, setActiveView] = useState(initialView)
  const [flipState, setFlipState] = useState('idle')
  const [displayView, setDisplayView] = useState(initialView)

  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/chat'} replace />
  }

  function handleNavigate(view) {
    if (view === activeView || flipState !== 'idle') return

    setFlipState('flipping-out')

    setTimeout(() => {
      setActiveView(view)
      setDisplayView(view)
      const path = view === 'login' ? '/login' : view === 'register' ? '/register' : '/forgot-password'
      navigate(path, { replace: true })
      setFlipState('flipping-in')
    }, 300)

    setTimeout(() => {
      setFlipState('idle')
    }, 600)
  }

  const flipClass = flipState === 'flipping-out'
    ? 'auth-card-flip-out'
    : flipState === 'flipping-in'
      ? 'auth-card-flip-in'
      : ''

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 sm:p-8 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply blur-3xl opacity-30 animate-pulse"></div>
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply blur-3xl opacity-30 animate-pulse" style={{ animationDelay: '2s' }}></div>
      <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply blur-3xl opacity-30 animate-pulse" style={{ animationDelay: '4s' }}></div>

      <div className="relative z-10 w-full max-w-7xl mx-auto flex items-center justify-center lg:justify-between gap-8 lg:gap-16 lg:px-8">
        <div className="hidden lg:flex flex-col justify-center flex-1 max-w-lg">
          <div className="flex items-center gap-3 mb-8">
            <img src="/logo.png" alt="HUST Messenger" className="w-12 h-12 rounded-xl shadow-lg shadow-indigo-500/30" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-purple-700">
              {t('branding.appName')}
            </span>
          </div>
          <h1 className="text-4xl xl:text-5xl font-extrabold text-slate-800 leading-tight tracking-tight mb-6">
            {t('branding.headline')}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-purple-700">
              {t('branding.headlineAccent')}
            </span>
            {t('branding.headlineAfterAccent')}
          </h1>
          <p className="text-slate-500 text-lg leading-relaxed mb-10">
            {t('branding.description')}
          </p>
          <div className="flex gap-4">
            <div className="flex-1 bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-2xl p-6 h-32 flex flex-col items-start justify-end gap-2 transition-all duration-300 hover:shadow-md hover:border-indigo-200">
              <div className="text-indigo-600">
                <Shield size={18} />
              </div>
              <span className="text-xs font-semibold text-slate-600 tracking-wider uppercase">
                {t('branding.feature1')}
              </span>
            </div>
            <div className="flex-1 bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-2xl p-6 h-32 flex flex-col items-start justify-end gap-2 transition-all duration-300 hover:shadow-md hover:border-indigo-200">
              <div className="text-indigo-600">
                <Gauge size={18} />
              </div>
              <span className="text-xs font-semibold text-slate-600 tracking-wider uppercase">
                {t('branding.feature2')}
              </span>
            </div>
          </div>
        </div>

        <div className="auth-flip-perspective w-full max-w-md shrink-0">
          <div className={`auth-card ${flipClass}`}>
            <div className="bg-white/80 backdrop-blur-xl p-8 sm:p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-slate-900/5">
              {displayView === 'login' && <LoginForm onNavigate={handleNavigate} />}
              {displayView === 'register' && <RegisterForm onNavigate={handleNavigate} />}
              {displayView === 'forgot-password' && <ForgotPasswordForm onNavigate={handleNavigate} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthPage
