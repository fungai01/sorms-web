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
  
  // Convert headers to Headers instance properly
  const headers = new Headers()
  
  // First, add headers from options.headers if they exist
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headers.set(key, value)
      })
    } else if (Array.isArray(options.headers)) {
      // Handle string[][] format
      options.headers.forEach(([key, value]) => {
        headers.set(key, value)
      })
    } else if (typeof options.headers === 'object') {
      // Handle Record<string, string>
      Object.entries(options.headers).forEach(([key, value]) => {
        headers.set(key, value)
      })
    }
  }

  if (!init?.skipAuth) {
    const urlString = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const publicEndpoints = [
      '/auth/outbound/authentication',
      '/auth/mobile/outbound/authentication',
      '/auth/login',
      '/auth/refresh',
    ]
    const isPublicEndpoint = publicEndpoints.some(publicPath => urlString.includes(publicPath))
    
    if (!headers.has('Authorization') && !headers.has('authorization')) {
      if (!isPublicEndpoint) {
        let token: string | null = null
        try {
          const userInfo = cookieManager.getUserInfo()
          if (userInfo && (userInfo as any).token) {
            token = (userInfo as any).token
          }
        } catch {}
        
        if (!token) {
          token = cookieManager.getAccessToken()
        }
        
        if (!token && typeof window !== 'undefined') {
          try {
            const userInfoStr = localStorage.getItem('auth_user_info')
            if (userInfoStr) {
              const userInfo = JSON.parse(userInfoStr)
              if (userInfo && userInfo.token) {
                token = userInfo.token
              }
            }
          } catch {}
          
          if (!token) {
            token = localStorage.getItem('auth_access_token')
          }
        }
        
        if (token) {
          headers.set('Authorization', `Bearer ${token}`)
        }
      }
    }
  }

  if (!headers.has('Content-Type')) {
    const hasBody = options.body !== undefined && options.method && options.method !== 'GET'
    if (hasBody) headers.set('Content-Type', 'application/json')
  }

  options.headers = headers
  return fetch(input as any, options)
}



