import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import ProfilePage from '../page'

// Mock Next.js router
const mockPush = jest.fn()
const mockReplace = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}))

// Mock useAuth hook
const mockUser = {
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
}

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: true,
    isLoading: false,
  }),
}))

// Mock fetch
global.fetch = jest.fn()

describe('ProfilePage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{
          id: '1',
          email: 'test@example.com',
          fullName: 'Test User',
          phoneNumber: '0123456789',
        }],
      }),
    })
  })

  it('renders profile page title', async () => {
    render(<ProfilePage />)
    await waitFor(() => {
      expect(screen.getByText(/Hồ sơ cá nhân/i)).toBeInTheDocument()
    })
  })

  it('displays user email', async () => {
    render(<ProfilePage />)
    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument()
    })
  })

  it('renders edit button', async () => {
    render(<ProfilePage />)
    await waitFor(() => {
      const editButton = screen.getByRole('button', { name: /Chỉnh sửa thông tin/i })
      expect(editButton).toBeInTheDocument()
    })
  })

  it('opens edit modal when edit button is clicked', async () => {
    const user = userEvent.setup()
    render(<ProfilePage />)
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Chỉnh sửa thông tin/i })).toBeInTheDocument()
    })

    const editButton = screen.getByRole('button', { name: /Chỉnh sửa thông tin/i })
    await user.click(editButton)

    await waitFor(() => {
      expect(screen.getByText(/Chỉnh sửa thông tin cá nhân/i)).toBeInTheDocument()
    })
  })

  it('renders back button', async () => {
    render(<ProfilePage />)
    await waitFor(() => {
      const backButton = screen.getByRole('button', { name: /Quay lại/i })
      expect(backButton).toBeInTheDocument()
    })
  })

  it('displays user information sections', async () => {
    render(<ProfilePage />)
    await waitFor(() => {
      expect(screen.getByText(/Thông tin cá nhân/i)).toBeInTheDocument()
      expect(screen.getByText(/Địa chỉ/i)).toBeInTheDocument()
    })
  })

  it('handles form validation', async () => {
    const user = userEvent.setup()
    render(<ProfilePage />)
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Chỉnh sửa thông tin/i })).toBeInTheDocument()
    })

    const editButton = screen.getByRole('button', { name: /Chỉnh sửa thông tin/i })
    await user.click(editButton)

    await waitFor(() => {
      expect(screen.getByText(/Chỉnh sửa thông tin cá nhân/i)).toBeInTheDocument()
    })

    // Try to submit empty form
    const updateButton = screen.getByRole('button', { name: /Cập nhật/i })
    await user.click(updateButton)

    await waitFor(() => {
      // Should show validation errors
      expect(screen.getByText(/Vui lòng điền đầy đủ các trường bắt buộc/i)).toBeInTheDocument()
    })
  })

  it('closes modal when cancel is clicked', async () => {
    const user = userEvent.setup()
    render(<ProfilePage />)
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Chỉnh sửa thông tin/i })).toBeInTheDocument()
    })

    const editButton = screen.getByRole('button', { name: /Chỉnh sửa thông tin/i })
    await user.click(editButton)

    await waitFor(() => {
      expect(screen.getByText(/Chỉnh sửa thông tin cá nhân/i)).toBeInTheDocument()
    })

    const cancelButton = screen.getByRole('button', { name: /Hủy/i })
    await user.click(cancelButton)

    await waitFor(() => {
      expect(screen.queryByText(/Chỉnh sửa thông tin cá nhân/i)).not.toBeInTheDocument()
    })
  })
})

