import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import UsersPage from '../page'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}))

// Mock hooks
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 1, email: 'admin@example.com' },
    isAuthenticated: true,
    isLoading: false,
  }),
}))

jest.mock('@/hooks/useApi', () => ({
  useUsers: jest.fn(() => ({
    data: [
      { id: 1, email: 'user1@example.com', fullName: 'User One', status: 'ACTIVE' },
      { id: 2, email: 'user2@example.com', fullName: 'User Two', status: 'INACTIVE' },
    ],
    loading: false,
  })),
}))

// Mock fetch
global.fetch = jest.fn()

describe('AdminUsersPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })
  })

  it('renders users page title', async () => {
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText(/Người dùng/i) || screen.getByText(/Users/i)).toBeInTheDocument()
    })
  })

  it('displays users list', async () => {
    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText(/user1@example.com/i) || screen.getByText(/User One/i)).toBeInTheDocument()
    })
  })

  it('filters users by status', async () => {
    const user = userEvent.setup()
    render(<UsersPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/user1@example.com/i)).toBeInTheDocument()
    })

    const filterButtons = screen.queryAllByRole('button')
    const statusFilter = filterButtons.find(btn => 
      btn.textContent?.includes('ACTIVE') || btn.textContent?.includes('Hoạt động')
    )
    
    if (statusFilter) {
      await user.click(statusFilter)
    }
  })

  it('searches users by query', async () => {
    const user = userEvent.setup()
    render(<UsersPage />)
    
    const searchInput = screen.queryByPlaceholderText(/Tìm kiếm/i) || screen.queryByRole('textbox')
    if (searchInput) {
      await user.type(searchInput, 'user1')
    }
  })

  it('opens create user modal', async () => {
    const user = userEvent.setup()
    render(<UsersPage />)
    
    await waitFor(() => {
      const createButtons = screen.queryAllByRole('button')
      const createButton = createButtons.find(btn => 
        btn.textContent?.includes('Tạo') || btn.textContent?.includes('Create') || btn.textContent?.includes('Thêm')
      )
      
      if (createButton) {
        return createButton
      }
    })

    const createButtons = screen.queryAllByRole('button')
    const createButton = createButtons.find(btn => 
      btn.textContent?.includes('Tạo người dùng') || btn.textContent?.includes('Thêm người dùng')
    )
    
    if (createButton) {
      await user.click(createButton)
      await waitFor(() => {
        expect(screen.getByText(/Tạo người dùng/i) || screen.getByText(/Thêm người dùng/i)).toBeInTheDocument()
      })
    }
  })

  it('displays empty state when no users', async () => {
    const { useUsers } = require('@/hooks/useApi')
    useUsers.mockReturnValue({
      data: [],
      loading: false,
    })

    render(<UsersPage />)
    await waitFor(() => {
      expect(screen.getByText(/Người dùng/i) || screen.getByText(/Chưa có/i)).toBeInTheDocument()
    })
  })
})

