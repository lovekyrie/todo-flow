import type { SubmitEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, errorMessage, setToken } from '../api'
import './AuthForm.scss'

function RegisterPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitError, setSubmitError] = useState('')

  const mismatch = confirmPassword !== '' && password !== confirmPassword
  const canSubmit = username.trim() !== '' && password !== '' && password === confirmPassword

  async function handleRegister(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit)
      return

    const response = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: username.trim(),
        password,
      }),
    })
    if (!response.ok) {
      setSubmitError(await errorMessage(response, '注册失败'))
      return
    }
    const data = await response.json()
    setToken(data.token)
    navigate('/')
  }

  return (
    <form className="auth-form" onSubmit={handleRegister}>
      <h1>注册</h1>
      <input
        type="text"
        value={username}
        placeholder="用户名"
        aria-label="用户名"
        onChange={event => setUsername(event.target.value)}
      />
      <input
        type="password"
        value={password}
        placeholder="密码"
        aria-label="密码"
        onChange={event => setPassword(event.target.value)}
      />
      <input
        type="password"
        value={confirmPassword}
        placeholder="确认密码"
        aria-label="确认密码"
        onChange={event => setConfirmPassword(event.target.value)}
      />
      {mismatch && <p className="error">密码不一致</p>}
      {submitError && <p className="error">{submitError}</p>}
      <button type="submit" disabled={!canSubmit}>注册</button>
      <Link to="/login">已有账号，去登录</Link>
    </form>
  )
}

export default RegisterPage
