// Configuration for API endpoints
export const API_CONFIG = {
  // Backend API base URL
  // Support both NEXT_PUBLIC_API_BASE_URL and NEXT_PUBLIC_API_URL for backward compatibility
  // Normalize: remove trailing slash, ensure it ends with /api
  BASE_URL: (() => {
    const rawUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'https://backend.sorms.online/api'
    // Remove trailing slash if exists
    const normalized = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl
    // Validate URL scheme
    try {
      const url = new URL(normalized)
      if (!['http:', 'https:'].includes(url.protocol)) {
        console.error('⚠️ Invalid API URL scheme:', url.protocol, '- Falling back to default')
        return 'https://backend.sorms.online/api'
      }
      return normalized
    } catch {
      console.error('⚠️ Invalid API URL format:', rawUrl, '- Falling back to default')
      return 'https://backend.sorms.online/api'
    }
  })(),
  // API endpoints
  ENDPOINTS: {
    ROOMS: '/rooms',
    BOOKINGS: '/bookings',
    TASKS: '/tasks',
    SERVICE_ORDERS: '/service-orders',
    PAYMENTS: '/payments',
    DASHBOARD: '/dashboard',
    AUTH: '/auth',
    USERS: '/users',
  },

  // Request timeout (in milliseconds)
  TIMEOUT: 30000, // Increased to 30s for Vercel cold starts

  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY: 1000, // 1 second
  },
}

// Environment check
export const isDevelopment = process.env.NODE_ENV === 'development'
export const isProduction = process.env.NODE_ENV === 'production'

// Log API configuration in development
if (isDevelopment) {
  console.log('🔧 API Configuration:', {
    BASE_URL: API_CONFIG.BASE_URL,
    TIMEOUT: API_CONFIG.TIMEOUT,
    ENV: process.env.NODE_ENV
  })
}
