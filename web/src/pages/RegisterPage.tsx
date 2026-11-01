import type { SubmitEvent } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorMessage, setToken } from '../api'
import AuthInput from '../components/AuthInput'
import AuthLayout from '../components/AuthLayout'

function RegisterPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const mismatch = confirmPassword !== '' && password !== confirmPassword
  const canSubmit = username.trim() !== '' && password !== '' && password === confirmPassword

  async function handleRegister(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit || submitting)
      return

    setSubmitting(true)
    setSubmitError('')
    try {
      const response = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      })
      if (!response.ok) {
        setSubmitError(await errorMessage(response, '注册失败，请稍后重试'))
        return
      }
      const data = await response.json()
      setToken(data.token)
      navigate('/', { replace: true })
    }
    catch {
      setSubmitError('网络连接失败，请稍后重试')
    }
    finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout mode="register">
      <form className="auth-form" onSubmit={handleRegister} aria-label="注册" aria-busy={submitting}>
        <AuthInput id="register-username" name="username" label="用户名" autoComplete="username" required value={username} onChange={event => setUsername(event.target.value)} />
        <AuthInput id="register-password" name="password" label="密码" type="password" autoComplete="new-password" required value={password} onChange={event => setPassword(event.target.value)} />
        <AuthInput
          id="register-confirm"
          name="confirmPassword"
          label="确认密码"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          aria-invalid={mismatch}
          aria-describedby={mismatch ? 'password-mismatch' : undefined}
          onChange={event => setConfirmPassword(event.target.value)}
        />
        {mismatch && <p className="feedback" id="password-mismatch" role="alert">两次输入的密码不一致</p>}
        {submitError && <p className="feedback" role="alert">{submitError}</p>}
        <button className="primary-button" type="submit" disabled={!canSubmit || submitting}>{submitting ? '注册中…' : '注册'}</button>
      </form>
    </AuthLayout>
  )
}

export default RegisterPage
