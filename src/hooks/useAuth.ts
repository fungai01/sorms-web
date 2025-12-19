'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { authService, type UserInfo } from '@/lib/auth-service'

export function useAuth() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<UserInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = authService.isAuthenticated()
        setIsAuthenticated(authenticated)

        if (authenticated) {
          // Lấy user info từ localStorage hoặc introspect token
          let userInfo = authService.getUserInfo()
          
          // Nếu không có user info, thử introspect token
          if (!userInfo) {
            userInfo = await authService.introspectToken()
          }

          setUser(userInfo)
        } else {
          setUser(null)
        }
      } catch {
        setIsAuthenticated(false)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  // Login with Google
  const loginWithGoogle = useCallback(async () => {
    try {
      const redirectUrl = await authService.getGoogleOAuthUrl()
      // Redirect đến Google OAuth
      window.location.href = redirectUrl
    } catch (error) {
      throw error
    }
  }, [])

  // Logout
  const logout = useCallback(async () => {
    try {
      await authService.logout()
      setIsAuthenticated(false)
      setUser(null)
      router.push('/login')
    } catch {
      setIsAuthenticated(false)
      setUser(null)
      router.push('/login')
    }
  }, [router])

  // Refresh token
  const refreshToken = useCallback(async () => {
    try {
      await authService.refreshAccessToken()
      // Re-check auth status
      const authenticated = authService.isAuthenticated()
      setIsAuthenticated(authenticated)
      
      if (authenticated) {
        const userInfo = authService.getUserInfo()
        setUser(userInfo)
      }
    } catch {
      // Token refresh failed, logout user
      await logout()
    }
  }, [logout])

  return {
    isAuthenticated,
    user,
    isLoading,
    loginWithGoogle,
    logout,
    refreshToken,
  }
}

