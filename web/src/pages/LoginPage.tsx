import type { SubmitEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, errorMessage, setToken } from '../api'
import './AuthForm.scss'

function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleLogin(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const response = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: username.trim(),
        password,
      }),
    })
    if (!response.ok) {
      setError(await errorMessage(response, '登录失败'))
      return
    }
    const data = await response.json()
    setToken(data.token)
    navigate('/')
  }

  return (
    <form className="auth-form" onSubmit={handleLogin}>
      <h1>登录</h1>
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
      {error && <p className="error">{error}</p>}
      <button type="submit">登录</button>
      <Link to="/register">没有账号，去注册</Link>
    </form>
  )
}

export default LoginPage
