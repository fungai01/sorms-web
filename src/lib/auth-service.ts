// Authentication service for managing auth state with backend API
import { NextRequest } from 'next/server'
import { apiClient } from './api-client'
import { cookieManager } from './http'

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

export const mapRoleToAppRole = (role?: string): 'admin' | 'office' |'staff' | 'user' => {
  if (!role) return 'user'
  let r = role.trim().toUpperCase()
  if (r.startsWith('ROLE_')) {
    r = r.substring(5)
  }
  if (['ADMIN_SYSTEM'].includes(r)) return 'admin'
  if (['ADMINISTRATIVE'].includes(r)) return 'office'
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
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to get OAuth URL')
    }
    
    const data = response.data as any
    const redirectUrl = typeof data === 'string' 
      ? data 
      : data?.redirectUrl || data?.url || ''
    
    if (!redirectUrl) {
      throw new Error('Missing redirect URL from backend')
    }
    
    return redirectUrl
  }

  async handleOAuthCallback(code: string, state?: string): Promise<AuthTokens> {
    if (!code || code.trim() === '') {
      throw new Error('Invalid authorization code')
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
      throw new Error('Invalid redirectUri')
    }
    
    const requestBody = {
      code: normalizedCode,
      redirectUri: redirectUri,
    }
    
    if (!requestBody.code || requestBody.code.length === 0) {
      throw new Error('Invalid code')
    }
    
    if (!requestBody.redirectUri || requestBody.redirectUri.length === 0) {
      throw new Error('Invalid redirectUri')
    }
    
    const codeUsedKey = `oauth_code_used_${normalizedCode.substring(0, 20)}`
    if (typeof window !== 'undefined') {
      const codeUsed = sessionStorage.getItem(codeUsedKey)
      if (codeUsed === 'true') {
        throw new Error('Authorization code already used')
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
      throw new Error(response.error || 'Authentication failed')
    }

    if (!response.data) {
      throw new Error('Authentication failed: empty response')
    }

    const data = response.data as any

    if (data.authenticated === false) {
      throw new Error('Authentication failed')
    }

    const accessToken = data.token || data.accessToken || data.access_token

    if (!accessToken) {
      throw new Error('Missing access token from backend')
    }

    const tokens: AuthTokens = {
      accessToken,
      refreshToken: data.refreshToken || data.refresh_token,
      expiresIn: data.expiresIn || data.expires_in,
    }

    this.setTokens(tokens)

    const accountInfo = data.accountInfo
    if (accountInfo) {
      // Backend AccountInfoAuthenticateDTO format: { id, email, firstName, lastName, avatarUrl, roles }
      // roles is List<String>, không có roleName, username
      const rolesArray = Array.isArray(accountInfo.roles) ? accountInfo.roles : []
      
      const userInfo: UserInfo = {
        id: accountInfo.id || '',
        email: accountInfo.email || '',
        username: accountInfo.username || accountInfo.email || '', // Fallback to email if no username
        firstName: accountInfo.firstName,
        lastName: accountInfo.lastName,
        name: accountInfo.firstName && accountInfo.lastName 
          ? `${accountInfo.firstName} ${accountInfo.lastName}`
          : accountInfo.firstName || accountInfo.lastName || accountInfo.email || '',
        picture: accountInfo.avatarUrl || accountInfo.picture,
        avatarUrl: accountInfo.avatarUrl,
        role: rolesArray.length > 0 ? String(rolesArray[0]) : accountInfo.role || 'USER',
        roleName: rolesArray, // Use roles as roleName
        roles: rolesArray,
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
    const refreshToken = this.getRefreshToken()
    if (!refreshToken) {
      throw new Error('Missing refresh token')
    }

    const response = await apiClient.refreshToken(refreshToken)
    if (response.success && response.data) {
      const data = response.data as any
      const newToken = data.token || data.accessToken || data.access_token
      
      if (!newToken) {
        throw new Error('Missing refreshed access token')
      }

      // Backend trả về refreshToken trong AuthenticationResponse (hoặc dùng lại refreshToken cũ)
      const nextRefreshToken = data.refreshToken || data.refresh_token || refreshToken
      
      const tokens: AuthTokens = {
        accessToken: newToken,
        refreshToken: nextRefreshToken,
        expiresIn: data.expiresIn || data.expires_in,
      }

      this.setTokens(tokens)

      if (data.accountInfo) {
        const accountInfo = data.accountInfo
        // Backend AccountInfoAuthenticateDTO format: { id, email, firstName, lastName, avatarUrl, roles }
        const rolesArray = Array.isArray(accountInfo.roles) ? accountInfo.roles : []
        
        const userInfo: UserInfo = {
          id: accountInfo.id || '',
          email: accountInfo.email || '',
          username: accountInfo.username || accountInfo.email || '',
          firstName: accountInfo.firstName,
          lastName: accountInfo.lastName,
          name: accountInfo.firstName && accountInfo.lastName 
            ? `${accountInfo.firstName} ${accountInfo.lastName}`
            : accountInfo.firstName || accountInfo.lastName || accountInfo.email || '',
          picture: accountInfo.avatarUrl || accountInfo.picture,
          avatarUrl: accountInfo.avatarUrl,
          role: rolesArray.length > 0 ? String(rolesArray[0]) : accountInfo.role || 'USER',
          roleName: rolesArray,
          roles: rolesArray,
        }
        this.setUserInfo(userInfo)
      }

      return tokens
    }

    throw new Error(response.error || 'Refresh token failed')
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

    const response = await apiClient.introspect(token)
    if (!response.success || !response.data) return null

    const data = response.data as any
    if (!data.valid) return null

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

  async logout(): Promise<void> {
    const token = this.getAccessToken()
    
    if (token) {
      await apiClient.logout(token).catch(() => {})
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

// ========== Auth Utils Functions (merged from auth-utils.ts) ==========

export function decodeJWTPayload(token: string): any | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }
    
    const payload = parts[1]
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
    const decoded = Buffer.from(padded, 'base64').toString('utf-8')
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

function getScopeFromToken(token: string): string | null {
  const payload = decodeJWTPayload(token)
  if (payload && payload.scope) {
    return String(payload.scope)
  }
  return null
}

export function getTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization')
  
  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7)
    }
    return authHeader
  }
  
  const authAccessTokenCookie = req.cookies.get('auth_access_token')?.value
  if (authAccessTokenCookie) {
    return authAccessTokenCookie
  }
  
  const accessTokenCookie = req.cookies.get('access_token')?.value
  if (accessTokenCookie) {
    return accessTokenCookie
  }
  
  const userInfoCookie = req.cookies.get('user_info')?.value
  if (userInfoCookie) {
    try {
      const decoded = decodeURIComponent(userInfoCookie)
      const userInfo = JSON.parse(decoded)
      if (userInfo && userInfo.token) {
        return userInfo.token
      }
    } catch {
      // ignore cookie parse error
    }
  }
  
  return null
}

export function getAuthorizationHeader(req: NextRequest): string {
  const token = getTokenFromRequest(req)
  return token ? `Bearer ${token}` : ''
}

export async function verifyToken(req: NextRequest): Promise<UserInfo | null> {
  try {
    const token = getTokenFromRequest(req)
    
    if (!token) {
      return null
    }
    
    const scopeFromToken = getScopeFromToken(token)
    const response = await apiClient.introspect(token)
    
    if (response.success && response.data) {
      const data = response.data as any
      
      if (data.valid === false) {
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
      
      let allRoles = rolesFromRoot.length > 0 
        ? rolesFromRoot 
        : rolesFromAccountInfo.length > 0 
          ? rolesFromAccountInfo 
          : roleNameFromAccountInfo
      
      let normalizedScope = scopeFromToken
      if (normalizedScope && normalizedScope.startsWith('ROLE_')) {
        normalizedScope = normalizedScope.substring(5)
      }
      
      if (normalizedScope) {
        if (allRoles.length === 0) {
          allRoles = [normalizedScope]
        } else {
          const scopeInRoles = allRoles.some((r: string) => 
            r === normalizedScope || 
            r === scopeFromToken || 
            r === `ROLE_${normalizedScope}` ||
            r.replace(/^ROLE_/, '') === normalizedScope
          )
          
          if (!scopeInRoles) {
            allRoles = [normalizedScope, ...allRoles]
          }
        }
      }
      
      const jwtPayload = decodeJWTPayload(token)
      const emailFromJWT = jwtPayload?.sub ? String(jwtPayload.sub) : null
      const userIdFromJWT = jwtPayload?.userId ? String(jwtPayload.userId) : null
      
      const finalEmail = accountInfo.email || data.username || emailFromJWT || ''
      const finalUserId = accountInfo.id || data.accountId || userIdFromJWT || ''
      
      const firstRole = allRoles.length > 0 
        ? String(allRoles[0]).replace(/^ROLE_/, '')
        : (accountInfo.role ? String(accountInfo.role).replace(/^ROLE_/, '') : (normalizedScope || ''))
      
      const normalizedRoles = allRoles.length > 0
        ? allRoles.map((r: string) => String(r).replace(/^ROLE_/, ''))
        : (rolesFromAccountInfo.length > 0 
            ? rolesFromAccountInfo.map((r: string) => String(r).replace(/^ROLE_/, ''))
            : (normalizedScope ? [normalizedScope] : []))
      
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
        role: firstRole,
        roleName: normalizedRoles,
        roles: normalizedRoles,
        status: accountInfo.status,
        dob: accountInfo.dob,
        address: accountInfo.address,
        phoneNumber: accountInfo.phoneNumber,
      }
      
      return userInfo
    }
    
    if (scopeFromToken) {
      const payload = decodeJWTPayload(token)
      const userInfo: UserInfo = {
        id: payload?.userId || '',
        email: payload?.sub || '',
        username: payload?.sub,
        role: scopeFromToken,
        roles: [scopeFromToken],
        roleName: [scopeFromToken],
      }
      return userInfo
    }
    
    return null
  } catch {
    return null
  }
}

export function isAdminEmail(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAIL_WHITELIST || 'quyentnqe170062@fpt.edu.vn').split(',')
  return adminEmails.some(adminEmail =>
    email.toLowerCase() === adminEmail.trim().toLowerCase()
  )
}

function normalizeRole(role: string): string {
  if (!role) return ''
  const normalized = String(role).trim().toUpperCase()
  return normalized.startsWith('ROLE_') ? normalized.substring(5) : normalized
}

export function isAdminRole(userInfo: UserInfo): boolean {
  if (!userInfo) {
    return false
  }

  if (userInfo.role) {
    const normalized = normalizeRole(userInfo.role)
    if (normalized === 'ADMIN' || normalized === 'ADMIN_SYTEM' || normalized === 'ADMINISTRATIVE') {
      return true
    }
  }

  const roles = userInfo.roles ||  userInfo.roleName || []
  if (Array.isArray(roles) && roles.length > 0) {
    const hasAdminRole = roles.some(role => {
      const normalized = normalizeRole(String(role))
      return normalized === 'ADMIN' || normalized === 'ADMIN_SYTEM' || normalized === 'ADMINISTRATIVE'
    })
    if (hasAdminRole) {
      return true
    }
  }

  const appRole = mapRoleToAppRole(userInfo.role)
  if (appRole === 'admin') {
    return true
  }

  return false
}

export async function isAdmin(req: NextRequest): Promise<boolean> {
  const userInfo = await verifyToken(req)
  
  if (!userInfo || !userInfo.email) {
    return false
  }
  
  const roleCheck = isAdminRole(userInfo)
  const emailCheck = isAdminEmail(userInfo.email)
  
  return roleCheck || emailCheck
}

