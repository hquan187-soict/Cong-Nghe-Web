import { useLang } from '../context/LangContext'

function LoginPage() {
  const { t } = useLang()

  function handleSubmit(e) {
    e.preventDefault()
    alert(`Bạn đã bấm: ${t('login.submit')}`)
  }

  return (
    <div className="page-center">
      <div className="card">
        <h1>{t('login.title')}</h1>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">{t('login.email')}</label>
            <input
              id="email"
              type="email"
              placeholder={t('login.emailPlaceholder')}
              className="input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">{t('login.password')}</label>
            <input
              id="password"
              type="password"
              placeholder={t('login.passwordPlaceholder')}
              className="input"
            />
          </div>

          <button type="submit" className="btn-primary">
            {t('login.submit')}
          </button>
        </form>

        <p className="page-footer">
          {t('login.noAccount')}{' '}
          <a href="/register">{t('login.registerLink')}</a>
        </p>
      </div>
    </div>
  )
}

export default LoginPage
