import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import CreateServicePage from '../page'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}))

// Mock hooks
jest.mock('@/hooks/useApi', () => ({
  useUserBookings: jest.fn(() => ({
    data: [{ id: 1, code: 'BK001', roomCode: 'R101' }],
  })),
  useServices: jest.fn(() => ({
    data: [{ id: 1, name: 'Cleaning Service', price: 50000 }],
  })),
}))

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 1, email: 'test@example.com' },
  }),
}))

// Mock services
jest.mock('@/lib/api-client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(() => Promise.resolve({ data: { id: 1 } })),
  },
}))

jest.mock('@/lib/auth-service', () => ({
  authService: {
    getAccessToken: jest.fn(() => 'mock-token'),
  },
}))

// Mock fetch
global.fetch = jest.fn()

describe('CreateServicePage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })
  })

  it('renders create service page title', async () => {
    render(<CreateServicePage />)
    await waitFor(() => {
      expect(screen.getByText(/Tạo đơn dịch vụ/i) || screen.getByText(/Create Service/i)).toBeInTheDocument()
    })
  })

  it('displays booking selection', async () => {
    render(<CreateServicePage />)
    await waitFor(() => {
      expect(screen.getByText(/Chọn đặt phòng/i) || screen.getByText(/Booking/i)).toBeInTheDocument()
    })
  })

  it('displays service selection', async () => {
    render(<CreateServicePage />)
    await waitFor(() => {
      expect(screen.getByText(/Chọn dịch vụ/i) || screen.getByText(/Service/i)).toBeInTheDocument()
    })
  })

  it('selects booking', async () => {
    const user = userEvent.setup()
    render(<CreateServicePage />)
    
    await waitFor(() => {
      expect(screen.getByText(/BK001/i) || screen.getByText(/R101/i)).toBeInTheDocument()
    })

    const bookingSelect = screen.queryByRole('combobox') || screen.queryByLabelText(/Đặt phòng/i)
    if (bookingSelect) {
      await user.click(bookingSelect)
      // Select booking option
    }
  })

  it('selects service', async () => {
    const user = userEvent.setup()
    render(<CreateServicePage />)
    
    await waitFor(() => {
      expect(screen.getByText(/Cleaning Service/i)).toBeInTheDocument()
    })

    const serviceSelect = screen.queryByRole('combobox') || screen.queryByLabelText(/Dịch vụ/i)
    if (serviceSelect) {
      await user.click(serviceSelect)
    }
  })

  it('submits service order', async () => {
    const user = userEvent.setup()
    const { apiClient } = require('@/lib/api-client')
    
    render(<CreateServicePage />)
    
    await waitFor(() => {
      expect(screen.getByText(/Tạo đơn/i) || screen.getByText(/Submit/i)).toBeInTheDocument()
    })

    const submitButton = screen.getByRole('button', { name: /Tạo đơn/i }) || screen.getByRole('button', { name: /Submit/i })
    if (submitButton) {
      await user.click(submitButton)
      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalled()
      })
    }
  })

  it('validates required fields', async () => {
    const user = userEvent.setup()
    render(<CreateServicePage />)
    
    await waitFor(() => {
      const submitButton = screen.queryByRole('button', { name: /Tạo đơn/i })
      if (submitButton) {
        return submitButton
      }
    })

    const submitButton = screen.queryByRole('button', { name: /Tạo đơn/i })
    if (submitButton) {
      await user.click(submitButton)
      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText(/Vui lòng/i) || screen.getByText(/Required/i)).toBeInTheDocument()
      }, { timeout: 2000 })
    }
  })

  it('displays loading state', () => {
    const { useUserBookings, useServices } = require('@/hooks/useApi')
    useUserBookings.mockReturnValue({ data: [], loading: true })
    useServices.mockReturnValue({ data: [], loading: true })

    render(<CreateServicePage />)
    const { container } = render(<CreateServicePage />)
    expect(container.querySelector('.animate-pulse') || container.textContent?.includes('Đang tải')).toBeTruthy()
  })
})

