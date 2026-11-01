import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon'
import '../pages/AuthForm.scss'

interface AuthLayoutProps {
  mode: 'login' | 'register'
  children: ReactNode
}

export default function AuthLayout({ mode, children }: AuthLayoutProps) {
  const isLogin = mode === 'login'

  return (
    <main className="auth-page">
      <div className="auth-content">
        <header className="auth-heading">
          <Icon name={isLogin ? 'logo' : 'register'} size={104} className="auth-logo" />
          <h1>{isLogin ? '欢迎回来' : '创建账号'}</h1>
          <p>{isLogin ? '登录你的账号，继续管理你的待办事项' : '加入我们，开始高效管理你的生活'}</p>
        </header>
        {children}
        <p className="auth-switch">
          <span>
            {isLogin ? '没有账号？' : '已有账号？'}
            {' '}
            <Link to={isLogin ? '/register' : '/login'}>{isLogin ? '去注册' : '去登录'}</Link>
          </span>
        </p>
      </div>
      <div className="auth-waves" aria-hidden="true" />
    </main>
  )
}
