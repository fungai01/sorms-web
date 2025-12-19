import { NextRequest } from 'next/server'
import { apiClient } from './api-client'
import type { UserInfo } from './auth-service'
import { mapRoleToAppRole } from './auth-service'

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
