import avatar from '../assets/ui/avatar.png'
import check from '../assets/ui/check.png'
import clock from '../assets/ui/clock.png'
import trash from '../assets/ui/delete.png'
import edit from '../assets/ui/edit.png'
import eye from '../assets/ui/eye.png'
import lock from '../assets/ui/lock.png'
import logo from '../assets/ui/logo.png'
import logout from '../assets/ui/logout.png'
import plus from '../assets/ui/plus.png'
import register from '../assets/ui/register.png'
import statActive from '../assets/ui/stat-active.png'
import statAll from '../assets/ui/stat-all.png'
import statCompleted from '../assets/ui/stat-completed.png'
import user from '../assets/ui/user.png'

const icons = {
  avatar,
  check,
  clock,
  'delete': trash,
  edit,
  eye,
  lock,
  logo,
  logout,
  plus,
  register,
  'stat-active': statActive,
  'stat-all': statAll,
  'stat-completed': statCompleted,
  user,
}

interface IconProps {
  name: keyof typeof icons
  size?: number
  className?: string
}

export default function Icon({ name, size = 24, className = '' }: IconProps) {
  return <img className={`icon ${className}`} src={icons[name]} width={size} height={size} alt="" aria-hidden="true" />
}
