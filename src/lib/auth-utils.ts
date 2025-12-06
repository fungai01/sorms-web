// Utility functions for authentication in API routes (server-side)
import { NextRequest } from 'next/server'
import { apiClient } from './api-client'
import type { UserInfo } from './auth-service'
import { mapRoleToAppRole } from './auth-service'

/**
 * Decode JWT payload (without verification)
 * Returns parsed payload object or null if invalid
 */
function decodeJWTPayload(token: string): any | null {
  try {
    // JWT format: header.payload.signature
    const parts = token.split('.')
    if (parts.length !== 3) {
      console.warn('[Auth Utils] Invalid JWT format: expected 3 parts, got', parts.length)
      return null
    }
    
    // Decode base64url payload (part 1)
    const payload = parts[1]
    // Replace URL-safe base64 characters
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    // Add padding if needed
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
    // Decode
    const decoded = Buffer.from(padded, 'base64').toString('utf-8')
    const parsed = JSON.parse(decoded)
    console.log('[Auth Utils] Decoded JWT payload:', { sub: parsed.sub, scope: parsed.scope, userId: parsed.userId })
    return parsed
  } catch (error) {
    console.error('[Auth Utils] Failed to decode JWT payload:', error)
    return null
  }
}

/**
 * Get scope from JWT token payload
 * Returns scope string or null if not found
 */
function getScopeFromToken(token: string): string | null {
  const payload = decodeJWTPayload(token)
  if (payload && payload.scope) {
    return String(payload.scope)
  }
  return null
}

/**
 * Get access token from request headers
 * Supports both "Bearer <token>" and direct token formats
 * Checks multiple sources: Authorization header, cookies (auth_access_token, access_token, user_info)
 */
export function getTokenFromRequest(req: NextRequest): string | null {
  // Priority 1: Check Authorization header
  const authHeader = req.headers.get('authorization')
  
  if (authHeader) {
    // Support "Bearer <token>" format
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      console.log('[Auth Utils] Token from Authorization header (Bearer)')
      return token
    }
    // Support direct token
    console.log('[Auth Utils] Token from Authorization header (direct)')
    return authHeader
  }
  
  // Priority 2: Check cookie auth_access_token
  const authAccessTokenCookie = req.cookies.get('auth_access_token')?.value
  if (authAccessTokenCookie) {
    console.log('[Auth Utils] Token from cookie auth_access_token')
    return authAccessTokenCookie
  }
  
  // Priority 3: Check cookie access_token
  const accessTokenCookie = req.cookies.get('access_token')?.value
  if (accessTokenCookie) {
    console.log('[Auth Utils] Token from cookie access_token')
    return accessTokenCookie
  }
  
  // Priority 4: Check cookie user_info (contains token in JSON)
  const userInfoCookie = req.cookies.get('user_info')?.value
  if (userInfoCookie) {
    try {
      // Decode URL-encoded cookie value
      const decoded = decodeURIComponent(userInfoCookie)
      const userInfo = JSON.parse(decoded)
      if (userInfo && userInfo.token) {
        console.log('[Auth Utils] Token from cookie user_info')
        return userInfo.token
      }
    } catch (error) {
      console.warn('[Auth Utils] Failed to parse user_info cookie:', error)
    }
  }
  
  console.warn('[Auth Utils] No token found in headers or cookies')
  return null
}

/**
 * Verify token and get user info from backend
 * Returns null if token is invalid or missing
 */
export async function verifyToken(req: NextRequest): Promise<UserInfo | null> {
  try {
    const token = getTokenFromRequest(req)
    
    if (!token) {
      console.warn('[Auth Utils] verifyToken: No token found')
      return null
    }
    
    // Try to get scope from JWT token directly (fallback)
    const scopeFromToken = getScopeFromToken(token)
    console.log('[Auth Utils] verifyToken: Scope from JWT token:', scopeFromToken)
    
    console.log('[Auth Utils] verifyToken: Calling introspect endpoint')
    
    // Call introspect endpoint to verify token and get user info
    const response = await apiClient.introspect(token)
    
    if (response.success && response.data) {
      const data = response.data as any
      
      console.log('[Auth Utils] verifyToken: Introspect response:', {
        valid: data.valid,
        hasAccountInfo: !!data.accountInfo,
        rolesFromRoot: data.roles,
        accountInfoRoles: data.accountInfo?.roles,
        accountInfoRoleName: data.accountInfo?.roleName,
        accountInfoRole: data.accountInfo?.role
      })
      
      // Check if token is valid
      if (data.valid === false) {
        console.warn('[Auth Utils] Token introspection: token is invalid')
        return null
      }
      
      // Backend trả về format: { valid, accountId, username, roles[], accountInfo: {...} }
      const accountInfo = data.accountInfo || {}
      const rolesFromRoot = Array.isArray(data.roles) ? data.roles : []
      const rolesFromAccountInfo = Array.isArray(accountInfo.roles) ? accountInfo.roles : []
      const roleNameFromAccountInfo = Array.isArray(accountInfo.roleName) ? accountInfo.roleName : []
      
      // Ưu tiên roles từ root level, sau đó từ accountInfo
      let allRoles = rolesFromRoot.length > 0 
        ? rolesFromRoot 
        : rolesFromAccountInfo.length > 0 
          ? rolesFromAccountInfo 
          : roleNameFromAccountInfo
      
      // Ưu tiên scope từ JWT token nếu có (vì nó là source of truth)
      if (scopeFromToken) {
        if (allRoles.length === 0) {
          console.log('[Auth Utils] verifyToken: Using scope from JWT token (no roles from introspection):', scopeFromToken)
          allRoles = [scopeFromToken]
        } else if (!allRoles.includes(scopeFromToken)) {
          // Nếu có scope từ token nhưng chưa có trong roles, thêm vào đầu
          console.log('[Auth Utils] verifyToken: Adding scope from JWT token to roles (prepend):', scopeFromToken)
          allRoles = [scopeFromToken, ...allRoles]
        } else {
          console.log('[Auth Utils] verifyToken: Scope from JWT token already in roles:', scopeFromToken)
        }
      }
      
      const userInfo: UserInfo = {
        id: accountInfo.id || data.accountId || '',
        email: accountInfo.email || '',
        username: accountInfo.username || data.username,
        firstName: accountInfo.firstName,
        lastName: accountInfo.lastName,
        name: accountInfo.firstName && accountInfo.lastName 
          ? `${accountInfo.firstName} ${accountInfo.lastName}`
          : accountInfo.firstName || accountInfo.lastName || accountInfo.email || data.username || '',
        picture: accountInfo.avatarUrl || accountInfo.picture,
        avatarUrl: accountInfo.avatarUrl,
        role: allRoles.length > 0 ? String(allRoles[0]) : accountInfo.role,
        roleName: allRoles.length > 0 ? allRoles : (roleNameFromAccountInfo.length > 0 ? roleNameFromAccountInfo : []),
        roles: allRoles.length > 0 ? allRoles : (rolesFromAccountInfo.length > 0 ? rolesFromAccountInfo : roleNameFromAccountInfo),
        status: accountInfo.status,
        dob: accountInfo.dob,
        address: accountInfo.address,
        phoneNumber: accountInfo.phoneNumber,
      }
      
      console.log('[Auth Utils] verifyToken: Parsed userInfo:', {
        email: userInfo.email,
        role: userInfo.role,
        roles: userInfo.roles,
        roleName: userInfo.roleName,
        scopeFromToken
      })
      
      return userInfo
    }
    
    console.warn('[Auth Utils] verifyToken: Introspect response not successful:', response.error)
    
    // Fallback: Nếu introspection fail nhưng có scope từ token, vẫn tạo userInfo cơ bản
    if (scopeFromToken) {
      console.log('[Auth Utils] verifyToken: Using scope from JWT token as fallback (introspect failed)')
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
  } catch (error) {
    console.error('[Auth Utils] Token verification failed:', error)
    return null
  }
}

/**
 * Check if user is admin based on email
 */
export function isAdminEmail(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAIL_WHITELIST || 'quyentnqe170062@fpt.edu.vn').split(',')
  return adminEmails.some(adminEmail =>
    email.toLowerCase() === adminEmail.trim().toLowerCase()
  )
}

/**
 * Normalize role string by stripping ROLE_ prefix and converting to uppercase
 */
function normalizeRole(role: string): string {
  if (!role) return ''
  const normalized = String(role).trim().toUpperCase()
  // Strip ROLE_ prefix if present
  const result = normalized.startsWith('ROLE_') ? normalized.substring(5) : normalized
  console.log('[Auth Utils] normalizeRole:', { input: role, normalized, result })
  return result
}

/**
 * Check if user has admin role from userInfo
 * Checks role, roles, and roleName fields for admin role
 * Supports both ROLE_ADMIN_SYTEM and ADMIN_SYTEM formats
 */
export function isAdminRole(userInfo: UserInfo): boolean {
  if (!userInfo) {
    return false
  }

  // Kiểm tra role string
  if (userInfo.role) {
    const normalized = normalizeRole(userInfo.role)
    if (normalized === 'ADMIN' || normalized === 'ADMIN_SYTEM' || normalized === 'ADMINISTRATIVE') {
      return true
    }
  }

  // Kiểm tra roles array
  const roles = userInfo.roles || userInfo.roleName || []
  if (Array.isArray(roles) && roles.length > 0) {
    const hasAdminRole = roles.some(role => {
      const normalized = normalizeRole(String(role))
      return normalized === 'ADMIN' || normalized === 'ADMIN_SYTEM' || normalized === 'ADMINISTRATIVE'
    })
    if (hasAdminRole) {
      return true
    }
  }

  // Kiểm tra appRole đã được map (nếu có)
  const appRole = mapRoleToAppRole(userInfo.role)
  if (appRole === 'admin') {
    return true
  }

  return false
}

/**
 * Check if user is admin from request
 * Returns true if user is admin, false otherwise
 * Priority: 1. Check role from token, 2. Check email whitelist
 */
export async function isAdmin(req: NextRequest): Promise<boolean> {
  try {
    const userInfo = await verifyToken(req)
    
    if (!userInfo || !userInfo.email) {
      console.log('[Auth Utils] Admin check: No userInfo or email')
      return false
    }
    
    // Ưu tiên kiểm tra role từ token
    const roleCheck = isAdminRole(userInfo)
    
    // Fallback: kiểm tra email whitelist
    const emailCheck = isAdminEmail(userInfo.email)
    
    const isAdminResult = roleCheck || emailCheck
    
    // Normalize roles for logging
    const normalizedRoles = (userInfo.roles || userInfo.roleName || []).map(r => normalizeRole(String(r)))
    const normalizedRole = userInfo.role ? normalizeRole(userInfo.role) : null
    
    console.log('[Auth Utils] Admin check:', {
      hasUserInfo: !!userInfo,
      email: userInfo.email,
      role: userInfo.role,
      normalizedRole,
      roles: userInfo.roles || userInfo.roleName,
      normalizedRoles,
      roleCheck,
      emailCheck,
      adminEmails: process.env.ADMIN_EMAIL_WHITELIST,
      isAdmin: isAdminResult
    })
    
    return isAdminResult
  } catch (error) {
    console.error('[Auth Utils] Error checking admin:', error)
    return false
  }
}
