const tokenKey = 'token'

export function getToken() {
  return localStorage.getItem(tokenKey)
}

export function setToken(token: string) {
  localStorage.setItem(tokenKey, token)
}

export function clearToken() {
  localStorage.removeItem(tokenKey)
}

export async function errorMessage(response: Response, fallback: string) {
  const data = await response.json().catch(() => null)
  const known: Record<string, string> = {
    'username taken': '用户名已存在',
    'invalid username or password': '用户名或密码错误',
    'username and password are required': '请填写用户名和密码',
  }
  return known[data?.error] ?? fallback
}

export async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (init.body)
    headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token)
    headers.set('Authorization', `Bearer ${token}`)
  return fetch(path, { ...init, headers })
}
