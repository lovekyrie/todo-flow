import type { SubmitEvent } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorMessage, setToken } from '../api'
import AuthInput from '../components/AuthInput'
import AuthLayout from '../components/AuthLayout'

function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleLogin(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting || !username.trim() || !password)
      return

    setSubmitting(true)
    setError('')
    try {
      const response = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      })
      if (!response.ok) {
        setError(await errorMessage(response, '登录失败，请稍后重试'))
        return
      }
      const data = await response.json()
      setToken(data.token)
      navigate('/', { replace: true })
    }
    catch {
      setError('网络连接失败，请稍后重试')
    }
    finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout mode="login">
      <form className="auth-form" onSubmit={handleLogin} aria-label="登录" aria-busy={submitting}>
        <AuthInput id="login-username" name="username" label="用户名" autoComplete="username" required value={username} onChange={event => setUsername(event.target.value)} />
        <AuthInput id="login-password" name="password" label="密码" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} />
        {error && <p className="feedback" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={submitting || !username.trim() || !password}>{submitting ? '登录中…' : '登录'}</button>
      </form>
    </AuthLayout>
  )
}

export default LoginPage
