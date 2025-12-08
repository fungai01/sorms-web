// Authentication service for managing auth state with backend API
import { apiClient } from './api-client'
import { cookieManager } from './http'
import { decodeJWTPayload } from './auth-utils'

export interface AuthTokens {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
}

export interface UserInfo {
  id?: string
  email: string
  username?: string
  firstName?: string
  lastName?: string
  name?: string
  picture?: string
  avatarUrl?: string
  role?: string
  roleName?: string[]
  roles?: string[]
  status?: string
  dob?: string
  address?: string
  phoneNumber?: string
}

export const mapRoleToAppRole = (role?: string): 'admin' | 'office' | 'security' | 'staff' | 'user' => {
  if (!role) return 'user'
  let r = role.trim().toUpperCase()
  if (r.startsWith('ROLE_')) {
    r = r.substring(5)
  }
  if (['ADMIN', 'ADMIN_SYTEM'].includes(r)) return 'admin'
  if (['ADMINISTRATIVE'].includes(r)) return 'office'
  if (['SECURITY', 'SERCURITY', 'SECURITY_GUARD'].includes(r)) return 'security'
  if (['STAFF'].includes(r)) return 'staff'
  if (['USER'].includes(r)) return 'user'
  return 'user'
}


class AuthService {
  private readonly ACCESS_TOKEN_KEY = 'auth_access_token'
  private readonly REFRESH_TOKEN_KEY = 'auth_refresh_token'
  private readonly USER_INFO_KEY = 'auth_user_info'

  async getGoogleOAuthUrl(): Promise<string> {
    let callbackUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/api/auth/callback/google`
      : 'http://localhost:3000/api/auth/callback/google'
    
    const normalizedCallbackUrl = callbackUrl.replace(/\/$/, '')
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('oauth_redirect_uri', normalizedCallbackUrl)
    }
    
    const scope = 'openid email profile'
    const response = await apiClient.getGoogleOAuthRedirectUrl(normalizedCallbackUrl, scope)
    
    if (response.success && response.data) {
      const data = response.data as any
      const redirectUrl = typeof data === 'string' 
        ? data 
        : data.redirectUrl || data.url || ''
      
      if (!redirectUrl) {
        throw new Error('Backend không trả về redirect URL')
      }
      
      return redirectUrl
    }
    
    throw new Error(response.error || 'Không thể lấy Google OAuth URL')
  }

  async handleOAuthCallback(code: string, state?: string): Promise<AuthTokens> {
    if (!code || code.trim() === '') {
      throw new Error('Mã xác thực không hợp lệ. Vui lòng thử đăng nhập lại.')
    }

    let normalizedCode = code.trim()
    try {
      normalizedCode = decodeURIComponent(normalizedCode)
    } catch {
      normalizedCode = code.trim()
    }
    
    let redirectUri: string = ''
    const savedRedirectUri = typeof window !== 'undefined' 
      ? localStorage.getItem('oauth_redirect_uri') 
      : null
    
    if (savedRedirectUri) {
      redirectUri = savedRedirectUri.trim()
    } else {
      if (typeof window !== 'undefined') {
        redirectUri = `${window.location.origin}/api/auth/callback/google`
      } else {
        redirectUri = 'http://localhost:3000/api/auth/callback/google'
      }
    }
    
    redirectUri = redirectUri.replace(/\/$/, '').trim()
    
    if (!redirectUri || redirectUri.length === 0) {
      throw new Error('RedirectUri không hợp lệ. Không thể xác định redirectUri.')
    }
    
    const requestBody = {
      code: normalizedCode,
      redirectUri: redirectUri,
    }
    
    if (!requestBody.code || requestBody.code.length === 0) {
      throw new Error('Mã xác thực không hợp lệ. Code không được để trống.')
    }
    
    if (!requestBody.redirectUri || requestBody.redirectUri.length === 0) {
      throw new Error('RedirectUri không hợp lệ. RedirectUri không được để trống.')
    }
    
    const codeUsedKey = `oauth_code_used_${normalizedCode.substring(0, 20)}`
    if (typeof window !== 'undefined') {
      const codeUsed = sessionStorage.getItem(codeUsedKey)
      if (codeUsed === 'true') {
        throw new Error('Mã xác thực đã được sử dụng. Vui lòng thử đăng nhập lại.')
      }
      sessionStorage.setItem(codeUsedKey, 'true')
    }
    
    const response = await apiClient.outboundAuth(requestBody)
    
    if (response.success && typeof window !== 'undefined') {
      localStorage.removeItem('oauth_redirect_uri')
    } else {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(codeUsedKey)
      }
    }

    if (!response.success) {
      const errorMsg = response.error || 'Xác thực thất bại'
      if (errorMsg.toLowerCase().includes('unauthenticated') || errorMsg.toLowerCase().includes('au0001')) {
        throw new Error('Xác thực thất bại. Mã xác thực đã hết hạn hoặc đã được sử dụng. Vui lòng thử đăng nhập lại.')
      }
      throw new Error(errorMsg)
    }

    if (!response.data) {
      throw new Error('Backend không trả về dữ liệu xác thực')
    }

    const data = response.data as any

    if (data.authenticated === false) {
      throw new Error('Xác thực thất bại. Vui lòng thử đăng nhập lại.')
    }

    const accessToken = data.token || data.accessToken || data.access_token

    if (!accessToken) {
      throw new Error('Backend không trả về access token. Vui lòng kiểm tra lại cấu hình.')
    }

    const tokens: AuthTokens = {
      accessToken,
      refreshToken: undefined,
      expiresIn: data.expiresIn || data.expires_in,
    }

    this.setTokens(tokens)

    const accountInfo = data.accountInfo
    if (accountInfo) {
      const roleNameArray = Array.isArray(accountInfo.roleName) ? accountInfo.roleName : []
      const rolesArray = Array.isArray(accountInfo.roles) ? accountInfo.roles : []
      const allRoles = roleNameArray.length > 0 ? roleNameArray : rolesArray
      
      const userInfo: UserInfo = {
        id: accountInfo.id || '',
        email: accountInfo.email || '',
        username: accountInfo.username,
        firstName: accountInfo.firstName,
        lastName: accountInfo.lastName,
        name: accountInfo.firstName && accountInfo.lastName 
          ? `${accountInfo.firstName} ${accountInfo.lastName}`
          : accountInfo.firstName || accountInfo.lastName || accountInfo.email || '',
        picture: accountInfo.avatarUrl || accountInfo.picture,
        avatarUrl: accountInfo.avatarUrl,
        role: allRoles.length > 0 ? String(allRoles[0]) : accountInfo.role,
        roleName: allRoles.length > 0 ? allRoles : (roleNameArray.length > 0 ? roleNameArray : []),
        roles: allRoles.length > 0 ? allRoles : (rolesArray.length > 0 ? rolesArray : roleNameArray),
      }
      
      this.setUserInfo(userInfo)
    } else if (data.email || data.name) {
      this.setUserInfo({
        email: data.email || '',
        name: data.name,
        picture: data.picture || data.avatarUrl,
        avatarUrl: data.avatarUrl,
        role: data.role,
        status: data.status,
      })
    }

    return tokens
  }

  setTokens(tokens: AuthTokens): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.ACCESS_TOKEN_KEY, tokens.accessToken)
      try { cookieManager.setAccessToken(tokens.accessToken) } catch {}
      if (tokens.refreshToken) {
        localStorage.setItem(this.REFRESH_TOKEN_KEY, tokens.refreshToken)
      } else {
        localStorage.removeItem(this.REFRESH_TOKEN_KEY)
      }
    }
  }

  getAccessToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.ACCESS_TOKEN_KEY)
    }
    return null
  }

  getRefreshToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.REFRESH_TOKEN_KEY)
    }
    return null
  }

  async refreshAccessToken(): Promise<AuthTokens> {
    const currentToken = this.getAccessToken()
    if (!currentToken) {
      throw new Error('Không có access token. Vui lòng đăng nhập lại.')
    }

    const response = await apiClient.refreshToken(currentToken)
    if (response.success && response.data) {
      const data = response.data as any
      const newToken = data.token || data.accessToken || data.access_token
      
      if (!newToken) {
        throw new Error('Backend không trả về access token mới sau khi refresh')
      }

      const tokens: AuthTokens = {
        accessToken: newToken,
        refreshToken: undefined,
        expiresIn: data.expiresIn || data.expires_in,
      }

      this.setTokens(tokens)

      if (data.accountInfo) {
        const accountInfo = data.accountInfo
        const userInfo: UserInfo = {
          id: accountInfo.id,
          email: accountInfo.email || '',
          username: accountInfo.username,
          firstName: accountInfo.firstName,
          lastName: accountInfo.lastName,
          name: accountInfo.firstName && accountInfo.lastName 
            ? `${accountInfo.firstName} ${accountInfo.lastName}`
            : accountInfo.firstName || accountInfo.lastName || accountInfo.email,
          picture: accountInfo.avatarUrl || accountInfo.picture,
          avatarUrl: accountInfo.avatarUrl,
          role: accountInfo.roleName?.[0] || accountInfo.roles?.[0],
          roleName: accountInfo.roleName || accountInfo.roles,
          roles: accountInfo.roleName || accountInfo.roles,
        }
        this.setUserInfo(userInfo)
      }

      return tokens
    }

    throw new Error(response.error || 'Làm mới token thất bại')
  }

  setUserInfo(user: UserInfo): void {
    if (typeof window !== 'undefined') {
      const currentToken = this.getAccessToken()
      const userInfoWithToken = currentToken 
        ? { ...user, token: currentToken }
        : user
      
      try {
        localStorage.setItem(this.USER_INFO_KEY, JSON.stringify(userInfoWithToken))
      } catch {}

      const roles = user.roles || user.roleName || (user.role ? [user.role] : [])
      const firstRole = Array.isArray(roles) && roles.length > 0 ? String(roles[0]) : (user.role || 'USER')
      const appRole = mapRoleToAppRole(firstRole)

      try { localStorage.setItem('userRole', appRole) } catch {}
      try { cookieManager.setRole(appRole) } catch {}

      const cookieUserInfo: any = { id: user.id, email: user.email, name: user.name, role: appRole }
      if (currentToken) {
        cookieUserInfo.token = currentToken
      }
      try { cookieManager.setUserInfo(cookieUserInfo) } catch {}
    }
  }

  getUserInfo(): UserInfo | null {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem(this.USER_INFO_KEY)
      if (userStr) {
        try {
          return JSON.parse(userStr) as UserInfo
        } catch {
          return null
        }
      }
    }
    return null
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.getAccessToken() !== null
  }

  async introspectToken(): Promise<UserInfo | null> {
    const token = this.getAccessToken()
    if (!token) {
      return null
    }

    try {
      const response = await apiClient.introspect(token)
      if (response.success && response.data) {
        const data = response.data as any
        
        if (!data.valid) {
          return null
        }

        const accountInfo = data.accountInfo && typeof data.accountInfo === 'object' ? data.accountInfo : {}
        
        const rolesFromRoot = Array.isArray(data.roles) 
          ? data.roles.map((r: any) => String(r).trim()).filter((r: string) => r.length > 0)
          : (data.roles === null ? [] : [])
        
        const rolesFromAccountInfo = accountInfo && Array.isArray(accountInfo.roles) 
          ? accountInfo.roles.map((r: any) => String(r).trim()).filter((r: string) => r.length > 0)
          : []
        
        const roleNameFromAccountInfo = accountInfo && Array.isArray(accountInfo.roleName) 
          ? accountInfo.roleName.map((r: any) => String(r).trim()).filter((r: string) => r.length > 0)
          : []
        
        const allRoles = rolesFromRoot.length > 0 
          ? rolesFromRoot 
          : rolesFromAccountInfo.length > 0 
            ? rolesFromAccountInfo 
            : roleNameFromAccountInfo
        
        const firstRoleRaw = allRoles.length > 0 
          ? String(allRoles[0]) 
          : (accountInfo.role || 'user')
        
        const firstRole = firstRoleRaw.replace(/^ROLE_/, '')
        const appRole = mapRoleToAppRole(firstRole)
        
        const normalizedRoles = allRoles.length > 0
          ? allRoles.map((r: string) => String(r).replace(/^ROLE_/, ''))
          : (rolesFromAccountInfo.length > 0 
              ? rolesFromAccountInfo.map((r: string) => String(r).replace(/^ROLE_/, ''))
              : [])
        
        const jwtPayload = decodeJWTPayload(token)
        const emailFromJWT = jwtPayload?.sub ? String(jwtPayload.sub) : null
        const userIdFromJWT = jwtPayload?.userId ? String(jwtPayload.userId) : null
        
        const finalEmail = accountInfo.email || data.username || emailFromJWT || ''
        const finalUserId = accountInfo.id || data.accountId || userIdFromJWT || ''
        
        const userInfo: UserInfo = {
          id: finalUserId,
          email: finalEmail,
          username: accountInfo.username || data.username || emailFromJWT || '',
          firstName: accountInfo.firstName,
          lastName: accountInfo.lastName,
          name: accountInfo.firstName && accountInfo.lastName 
            ? `${accountInfo.firstName} ${accountInfo.lastName}`
            : accountInfo.firstName || accountInfo.lastName || accountInfo.email || data.username || emailFromJWT || '',
          picture: accountInfo.avatarUrl || accountInfo.picture,
          avatarUrl: accountInfo.avatarUrl,
          role: appRole,
          roleName: normalizedRoles,
          roles: normalizedRoles,
          dob: accountInfo.dob,
          address: accountInfo.address,
          phoneNumber: accountInfo.phoneNumber,
        }
        
        this.setUserInfo(userInfo)
        return userInfo
      }
    } catch (error) {
      console.error('Token introspection failed:', error)
    }

    return null
  }

  async login(username: string, password: string): Promise<AuthTokens> {
    const response = await apiClient.login({ username, password })
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Đăng nhập thất bại')
    }
    
    const data = response.data as any
    const accessToken = data.token || data.accessToken || data.access_token
    const accountInfo = data.accountInfo || data.user
    
    if (!accessToken) {
      throw new Error('Backend không trả về access token')
    }
    
    const tokens: AuthTokens = {
      accessToken,
      refreshToken: data.refreshToken || data.refresh_token,
      expiresIn: data.expiresIn || data.expires_in,
    }
    
    this.setTokens(tokens)
    
    if (accountInfo) {
      const userInfo: UserInfo = {
        id: accountInfo.id,
        email: accountInfo.email || '',
        username: accountInfo.username,
        firstName: accountInfo.firstName,
        lastName: accountInfo.lastName,
        name: accountInfo.firstName && accountInfo.lastName 
          ? `${accountInfo.firstName} ${accountInfo.lastName}`
          : accountInfo.firstName || accountInfo.lastName || accountInfo.email,
        picture: accountInfo.avatarUrl || accountInfo.picture,
        avatarUrl: accountInfo.avatarUrl,
        role: accountInfo.roleName?.[0] || accountInfo.roles?.[0],
        roleName: accountInfo.roleName || accountInfo.roles,
        roles: accountInfo.roleName || accountInfo.roles,
        status: accountInfo.status,
        dob: accountInfo.dob,
        address: accountInfo.address,
        phoneNumber: accountInfo.phoneNumber,
      }
      this.setUserInfo(userInfo)
    }
    
    return tokens
  }

  async logout(): Promise<void> {
    const token = this.getAccessToken()
    
    try {
      if (token) {
        await apiClient.logout(token)
      }
    } catch (error) {
      console.error('Logout API call failed:', error)
    }

    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.ACCESS_TOKEN_KEY)
      localStorage.removeItem(this.REFRESH_TOKEN_KEY)
      localStorage.removeItem(this.USER_INFO_KEY)
      localStorage.removeItem('userRole')
      localStorage.removeItem('isLoggedIn')
      localStorage.removeItem('userName')
      localStorage.removeItem('userEmail')
      localStorage.removeItem('userPicture')
      sessionStorage.removeItem('userRole')
      sessionStorage.removeItem('previousPage')
      try { cookieManager.clearAll() } catch {}
      document.cookie = 'approved=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    }
  }

  clearAuth(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.ACCESS_TOKEN_KEY)
      localStorage.removeItem(this.REFRESH_TOKEN_KEY)
      localStorage.removeItem(this.USER_INFO_KEY)
    }
  }
}

// Export singleton instance
export const authService = new AuthService()

