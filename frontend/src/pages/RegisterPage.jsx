import { useLang } from '../context/LangContext'

function RegisterPage() {
  const { t } = useLang()

  function handleSubmit(e) {
    e.preventDefault()
    alert(`Bạn đã bấm: ${t('register.submit')}`)
  }

  return (
    <div className="page-center">
      <div className="card">
        <h1>{t('register.title')}</h1>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">{t('register.username')}</label>
            <input
              id="username"
              type="text"
              placeholder={t('register.usernamePlaceholder')}
              className="input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">{t('register.email')}</label>
            <input
              id="email"
              type="email"
              placeholder={t('register.emailPlaceholder')}
              className="input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">{t('register.password')}</label>
            <input
              id="password"
              type="password"
              placeholder={t('register.passwordPlaceholder')}
              className="input"
            />
          </div>

          <button type="submit" className="btn-primary">
            {t('register.submit')}
          </button>
        </form>

        <p className="page-footer">
          {t('register.hasAccount')}{' '}
          <a href="/login">{t('register.loginLink')}</a>
        </p>
      </div>
    </div>
  )
}

export default RegisterPage
