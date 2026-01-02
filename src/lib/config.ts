export const API_CONFIG = {
  BASE_URL: (() => {
    // Use environment variable if set, otherwise use default based on NODE_ENV
    const defaultUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === 'production'
      ? 'https://backend.sorms.online/api'
      : 'http://103.81.87.99:5656/api/');
  
    
    const rawUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || defaultUrl
    const normalized = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl
    try {
      const url = new URL(normalized)
      if (!['http:', 'https:'].includes(url.protocol)) {
        return defaultUrl
      }
      return normalized
    } catch {
      return defaultUrl
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
