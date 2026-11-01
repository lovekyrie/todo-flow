import type { InputHTMLAttributes } from 'react'
import { useState } from 'react'
import Icon from './Icon'

interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string
  label: string
}

export default function AuthInput({ id, label, type = 'text', ...props }: AuthInputProps) {
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className="auth-input">
      <label className="sr-only" htmlFor={id}>{label}</label>
      <Icon name={isPassword ? 'lock' : 'user'} />
      <input
        {...props}
        id={id}
        type={isPassword && visible
          ? 'text'
          : type}
        placeholder={label}
      />
      {isPassword && (
        <button
          className="password-toggle icon-button"
          type="button"
          aria-label={(visible ? '隐藏' : '显示') + label}
          aria-pressed={visible}
          onClick={() => setVisible(current => !current)}
        >
          <Icon name="eye" />
        </button>
      )}
    </div>
  )
}
