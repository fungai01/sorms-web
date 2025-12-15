import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import AuthCallbackPage from '../page'

// Mock Next.js router
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === 'code') return 'test-code'
      if (key === 'state') return 'test-state'
      return null
    },
  }),
}))

// Mock auth service
jest.mock('@/lib/auth-service', () => ({
  authService: {
    handleOAuthCallback: jest.fn(() => Promise.resolve({ accessToken: 'token', refreshToken: 'refresh' })),
    getUserInfo: jest.fn(() => ({ id: 1, email: 'test@example.com', role: 'user' })),
    introspectToken: jest.fn(() => Promise.resolve({ id: 1, email: 'test@example.com', role: 'user' })),
    clearAuth: jest.fn(),
  },
  mapRoleToAppRole: jest.fn((role) => role.toLowerCase()),
}))

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(() => null),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    })
    // Mock sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: jest.fn(() => null),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    })
  })

  it('renders loading state initially', async () => {
    render(<AuthCallbackPage />)
    await waitFor(() => {
      expect(screen.getByText(/Đang xác thực/i) || screen.queryByText(/Loading/i)).toBeInTheDocument()
    })
  })

  it('processes OAuth callback with code', async () => {
    const { authService } = require('@/lib/auth-service')
    
    render(<AuthCallbackPage />)
    
    await waitFor(() => {
      expect(authService.handleOAuthCallback).toHaveBeenCalledWith('test-code', 'test-state')
    }, { timeout: 3000 })
  })

  it('displays error when OAuth fails', async () => {
    const { useSearchParams } = require('next/navigation')
    useSearchParams.mockReturnValue({
      get: (key: string) => {
        if (key === 'error') return 'access_denied'
        return null
      },
    })

    render(<AuthCallbackPage />)
    await waitFor(() => {
      expect(screen.getByText(/Lỗi/i) || screen.queryByText(/Error/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('displays error when no code provided', async () => {
    const { useSearchParams } = require('next/navigation')
    useSearchParams.mockReturnValue({
      get: () => null,
    })

    const { authService } = require('@/lib/auth-service')
    authService.handleOAuthCallback.mockRejectedValueOnce(new Error('No code'))

    render(<AuthCallbackPage />)
    await waitFor(() => {
      expect(screen.getByText(/Lỗi/i) || screen.queryByText(/Error/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('redirects to dashboard after successful auth', async () => {
    const { authService } = require('@/lib/auth-service')
    authService.getUserInfo.mockReturnValue({ id: 1, email: 'test@example.com', role: 'user' })
    
    render(<AuthCallbackPage />)
    
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/user/dashboard')
    }, { timeout: 5000 })
  })

  it('redirects admin to admin dashboard', async () => {
    const { authService } = require('@/lib/auth-service')
    authService.getUserInfo.mockReturnValue({ id: 1, email: 'admin@example.com', role: 'admin' })
    
    render(<AuthCallbackPage />)
    
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin/dashboard')
    }, { timeout: 5000 })
  })

  it('handles popup window communication', async () => {
    // Mock window.opener
    const mockPostMessage = jest.fn()
    Object.defineProperty(window, 'opener', {
      value: {
        postMessage: mockPostMessage,
        closed: false,
      },
      writable: true,
    })

    render(<AuthCallbackPage />)
    
    await waitFor(() => {
      // Should send message to opener if in popup
      expect(mockPostMessage).toHaveBeenCalled()
    }, { timeout: 5000 })
  })
})

