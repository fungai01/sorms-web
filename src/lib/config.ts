export const API_CONFIG = {
  BASE_URL: (() => {
    const rawUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'https://backend.sorms.online/api'
    const normalized = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl
    try {
      const url = new URL(normalized)
      if (!['http:', 'https:'].includes(url.protocol)) {
        console.error('Invalid API URL scheme:', url.protocol)
        return 'https://backend.sorms.online/api'
      }
      return normalized
    } catch {
      console.error('Invalid API URL format:', rawUrl)
      return 'https://backend.sorms.online/api'
    }
  })(),
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
  AI_BASE_URL: process.env.NEXT_PUBLIC_AI_BASE_URL || 'http://103.81.87.99:9001',
  TIMEOUT: 30000,
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY: 1000,
  },
}

export const isDevelopment = process.env.NODE_ENV === 'development'
export const isProduction = process.env.NODE_ENV === 'production'
