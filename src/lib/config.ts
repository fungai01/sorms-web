// Configuration for API endpoints
export const API_CONFIG = {
  // Backend API base URL
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://103.81.87.99:5656/api',
  
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
  TIMEOUT: 10000,
  
  // Retry configuration
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY: 1000, // 1 second
  },
}

// Environment check
export const isDevelopment = process.env.NODE_ENV === 'development'
export const isProduction = process.env.NODE_ENV === 'production'
