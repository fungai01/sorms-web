// Unified HTTP utilities: CookieManager + authFetch interceptor
// Centralize token/role cookie handling and authenticated fetch wrapper

export type AppRole = 'admin' | 'office' | 'staff' | 'user'

function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function buildCookie(name: string, value: string, days?: number) {
  const enc = encodeURIComponent
  const v = enc(value)
  const pieces: string[] = []
  pieces.push(`${name}=${v}`)
  pieces.push('Path=/')
  pieces.push('SameSite=Lax')
  if (isBrowser() && window.location.protocol === 'https:') pieces.push('Secure')
  if (days && days > 0) {
    const d = new Date()
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000)
    pieces.push(`Expires=${d.toUTCString()}`)
  }
  return pieces.join('; ')
}

class CookieManager {
  private ACCESS_TOKEN_COOKIE = 'access_token'
  private ROLE_COOKIE = 'role'
  private USER_COOKIE = 'user_info'

  setAccessToken(token: string, days = 7) {
    if (!isBrowser()) return
    document.cookie = buildCookie(this.ACCESS_TOKEN_COOKIE, token, days)
  }
  getAccessToken(): string | null {
    if (!isBrowser()) return null
    const match = document.cookie.match(new RegExp('(?:^|; )' + this.ACCESS_TOKEN_COOKIE + '=([^;]*)'))
    return match ? decodeURIComponent(match[1]) : null
  }
  clearAccessToken() {
    if (!isBrowser()) return
    document.cookie = `${this.ACCESS_TOKEN_COOKIE}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax`
  }

  setRole(role: AppRole, days = 7) {
    if (!isBrowser()) return
    document.cookie = buildCookie(this.ROLE_COOKIE, role, days)
  }
  getRole(): AppRole | null {
    if (!isBrowser()) return null
    const match = document.cookie.match(new RegExp('(?:^|; )' + this.ROLE_COOKIE + '=([^;]*)'))
    return match ? (decodeURIComponent(match[1]) as AppRole) : null
  }
  clearRole() {
    if (!isBrowser()) return
    document.cookie = `${this.ROLE_COOKIE}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax`
  }

  setUserInfo(user: any, days = 7) {
    if (!isBrowser()) return
    try { document.cookie = buildCookie(this.USER_COOKIE, JSON.stringify(user), days) } catch {}
  }
  getUserInfo<T = any>(): T | null {
    if (!isBrowser()) return null
    const match = document.cookie.match(new RegExp('(?:^|; )' + this.USER_COOKIE + '=([^;]*)'))
    if (!match) return null
    try { return JSON.parse(decodeURIComponent(match[1])) as T } catch { return null }
  }
  clearUserInfo() {
    if (!isBrowser()) return
    document.cookie = `${this.USER_COOKIE}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax`
  }

  clearAll() { this.clearAccessToken(); this.clearRole(); this.clearUserInfo() }
}

export const cookieManager = new CookieManager()

export type AuthFetchOptions = RequestInit & { skipAuth?: boolean }

export async function authFetch(input: string | URL | Request, init?: AuthFetchOptions): Promise<Response> {
  const options: RequestInit = { ...init }
  if (options.credentials === undefined) options.credentials = 'include'
  const headers = new Headers(options.headers || {})

  if (!init?.skipAuth) {
    let token = cookieManager.getAccessToken()
    if (!token && typeof window !== 'undefined') {
      try { token = localStorage.getItem('auth_access_token') } catch {}
    }
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
  }

  if (!headers.has('Content-Type')) {
    const hasBody = options.body !== undefined && options.method && options.method !== 'GET'
    if (hasBody) headers.set('Content-Type', 'application/json')
  }

  options.headers = headers
  return fetch(input as any, options)
}


