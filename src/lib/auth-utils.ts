// Utility functions for authentication in API routes (server-side)
import { NextRequest } from 'next/server'
import { apiClient } from './api-client'
import type { UserInfo } from './auth-service'

/**
 * Get access token from request headers
 * Supports both "Bearer <token>" and direct token formats
 */
export function getTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization')
  
  if (authHeader) {
    // Support "Bearer <token>" format
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7)
    }
    // Support direct token
    return authHeader
  }
  
  // Also check cookies as fallback
  const tokenCookie = req.cookies.get('auth_access_token')?.value
  if (tokenCookie) {
    return tokenCookie
  }
  
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
      return null
    }
    
    // Call introspect endpoint to verify token and get user info
    const response = await apiClient.introspect(token)
    
    if (response.success && response.data) {
      const accountInfo = (response.data as any).accountInfo || response.data
      
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
 * Check if user is admin from request
 * Returns true if user is admin, false otherwise
 */
export async function isAdmin(req: NextRequest): Promise<boolean> {
  try {
    const userInfo = await verifyToken(req)
    
    if (!userInfo || !userInfo.email) {
      return false
    }
    
    const adminCheck = isAdminEmail(userInfo.email)
    
    console.log('[Auth Utils] Admin check:', {
      hasUserInfo: !!userInfo,
      email: userInfo.email,
      adminEmails: process.env.ADMIN_EMAIL_WHITELIST,
      isAdmin: adminCheck
    })
    
    return adminCheck
  } catch (error) {
    console.error('[Auth Utils] Error checking admin:', error)
    return false
  }
}







