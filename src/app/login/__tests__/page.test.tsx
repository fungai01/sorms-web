import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import LoginPage from '../page'

// Mock Next.js components
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, ...props }: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />
  },
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}))

// Mock auth service
jest.mock('@/lib/auth-service', () => ({
  authService: {
    getGoogleOAuthUrl: jest.fn(() => Promise.resolve('https://oauth.google.com')),
  },
}))

// Mock useAuth hook
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    loginWithGoogle: jest.fn(),
  }),
}))

// Mock window.open
const mockWindowOpen = jest.fn()
Object.defineProperty(window, 'open', {
  writable: true,
  value: mockWindowOpen,
})

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Mock window.location.search
    delete (window as any).location
    window.location = { ...window.location, search: '' }
  })

  it('renders login page title', () => {
    render(<LoginPage />)
    expect(screen.getByText(/Đăng nhập SORMS/i)).toBeInTheDocument()
  })

  it('renders Google sign-in button', () => {
    render(<LoginPage />)
    const button = screen.getByRole('button', { name: /đăng nhập với google/i })
    expect(button).toBeInTheDocument()
  })

  it('displays error message from URL params', () => {
    // Mock URLSearchParams
    const mockSearchParams = new URLSearchParams('error=inactive')
    jest.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      search: '?error=inactive',
    })

    render(<LoginPage />)
    expect(screen.getByText(/Tài khoản của bạn chưa được kích hoạt/i)).toBeInTheDocument()
  })

  it('handles Google sign-in click', async () => {
    const user = userEvent.setup()
    const { authService } = require('@/lib/auth-service')
    
    // Mock popup window
    const mockPopup = {
      closed: false,
      close: jest.fn(),
    }
    mockWindowOpen.mockReturnValue(mockPopup)

    render(<LoginPage />)
    const button = screen.getByRole('button', { name: /đăng nhập với google/i })
    
    await user.click(button)

    await waitFor(() => {
      expect(authService.getGoogleOAuthUrl).toHaveBeenCalled()
      expect(mockWindowOpen).toHaveBeenCalled()
    })
  })

  it('shows loading state when signing in', async () => {
    const user = userEvent.setup()
    const { authService } = require('@/lib/auth-service')
    
    // Mock popup that stays open
    const mockPopup = {
      closed: false,
      close: jest.fn(),
    }
    mockWindowOpen.mockReturnValue(mockPopup)

    render(<LoginPage />)
    const button = screen.getByRole('button', { name: /đăng nhập với google/i })
    
    await user.click(button)

    await waitFor(() => {
      expect(screen.getByText(/Đang xử lý/i)).toBeInTheDocument()
    })
  })

  it('displays error when popup is blocked', async () => {
    const user = userEvent.setup()
    const { authService } = require('@/lib/auth-service')
    
    // Mock window.open returning null (popup blocked)
    mockWindowOpen.mockReturnValue(null)

    render(<LoginPage />)
    const button = screen.getByRole('button', { name: /đăng nhập với google/i })
    
    await user.click(button)

    await waitFor(() => {
      expect(screen.getByText(/Không thể mở cửa sổ đăng nhập/i)).toBeInTheDocument()
    })
  })

  it('renders logo image', () => {
    render(<LoginPage />)
    const logo = screen.getByAltText(/SORMS logo/i)
    expect(logo).toBeInTheDocument()
  })

  it('renders subtitle text', () => {
    render(<LoginPage />)
    expect(screen.getByText(/Hệ thống quản lý nhà công vụ thông minh/i)).toBeInTheDocument()
  })
})

