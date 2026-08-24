import { useState } from 'react'
import { supabase, emailForUsername, USERNAME_RE } from '../supabaseClient'

export default function Auth() {
  const [mode, setMode] = useState('login') // login | register
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')

    if (!USERNAME_RE.test(username)) {
      setError('Username: только английские буквы и цифры, 3–20 символов, без пробелов')
      return
    }
    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов')
      return
    }

    setBusy(true)
    try {
      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email: emailForUsername(username),
          password,
          options: { data: { username: username.toLowerCase(), display_name: displayName.trim() || username } },
        })
        if (error) {
          if (error.message.includes('already registered') || error.message.includes('already exists')) {
            setError('Этот username уже занят')
          } else {
            setError('Ошибка регистрации: ' + error.message)
          }
        } else if (data.session) {
          // ok, onAuthStateChange подхватит
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: emailForUsername(username),
          password,
        })
        if (error) setError('Неверный username или пароль')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-badge">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none">
              <path d="M12 3C7 3 3 6.6 3 11c0 2.5 1.3 4.7 3.4 6.2-.2 1.2-.8 2.5-2 3.5 2.2-.2 4-.9 5.3-1.8 1.1.3 2.2.5 3.3.5 5 0 9-3.6 9-8.4S17 3 12 3z" fill="currentColor"/>
            </svg>
          </div>
          <h1>Messenger<span>+</span></h1>
        </div>

        <div className="tabs">
          <button className={mode === 'login' ? 'tab active' : 'tab'} onClick={() => { setMode('login'); setError('') }}>Вход</button>
          <button className={mode === 'register' ? 'tab active' : 'tab'} onClick={() => { setMode('register'); setError('') }}>Регистрация</button>
        </div>

        <form onSubmit={submit} className="auth-form">
          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
              placeholder="например, ahmad2007"
              autoFocus
            />
          </label>

          {mode === 'register' && (
            <label>
              Имя (как вас будут видеть)
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ахмад"
                maxLength={30}
              />
            </label>
          )}

          <label>
            Пароль
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="минимум 6 символов"
            />
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button className="btn-primary" disabled={busy}>
            {busy ? <span className="spinner" /> : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </form>
      </div>
    </div>
  )
}
