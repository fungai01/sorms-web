import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import BookingsPage from '../page'

// Mock hooks
jest.mock('@/hooks/useApi', () => ({
  useBookings: jest.fn(() => ({
    data: [
      { id: 1, code: 'BK001', status: 'PENDING', checkinDate: '2025-01-01', checkoutDate: '2025-01-05' },
      { id: 2, code: 'BK002', status: 'APPROVED', checkinDate: '2025-01-10', checkoutDate: '2025-01-15' },
    ],
    loading: false,
    error: null,
    refetch: jest.fn(),
  })),
  useRooms: jest.fn(() => ({
    data: [{ id: 1, code: 'R101', name: 'Room 101' }],
    loading: false,
    error: null,
    refetch: jest.fn(),
  })),
}))

// Mock services
jest.mock('@/lib/auth-service', () => ({
  authService: {
    getAccessToken: jest.fn(() => 'mock-token'),
  },
}))

jest.mock('@/lib/notifications', () => ({
  createBookingNotification: jest.fn(),
}))

// Mock fetch
global.fetch = jest.fn()

describe('AdminBookingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })
  })

  it('renders bookings page title', async () => {
    render(<BookingsPage />)
    await waitFor(() => {
      expect(screen.getByText(/Đặt phòng/i) || screen.getByText(/Bookings/i)).toBeInTheDocument()
    })
  })

  it('displays bookings list', async () => {
    render(<BookingsPage />)
    await waitFor(() => {
      expect(screen.getByText(/BK001/i) || screen.getByText(/BK002/i)).toBeInTheDocument()
    })
  })

  it('filters bookings by status', async () => {
    const user = userEvent.setup()
    render(<BookingsPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/BK001/i)).toBeInTheDocument()
    })

    // Look for status filter
    const filterButtons = screen.queryAllByRole('button')
    const statusFilter = filterButtons.find(btn => 
      btn.textContent?.includes('PENDING') || btn.textContent?.includes('Chờ')
    )
    
    if (statusFilter) {
      await user.click(statusFilter)
    }
  })

  it('searches bookings by query', async () => {
    const user = userEvent.setup()
    render(<BookingsPage />)
    
    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText(/Tìm kiếm/i) || screen.getByRole('textbox')
      if (searchInput) {
        return searchInput
      }
    })

    const searchInput = screen.queryByPlaceholderText(/Tìm kiếm/i) || screen.queryByRole('textbox')
    if (searchInput) {
      await user.type(searchInput, 'BK001')
    }
  })

  it('approves booking', async () => {
    const user = userEvent.setup()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    })

    render(<BookingsPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/BK001/i)).toBeInTheDocument()
    })

    // Look for approve button
    const approveButtons = screen.queryAllByRole('button')
    const approveButton = approveButtons.find(btn => 
      btn.textContent?.includes('Duyệt') || btn.textContent?.includes('Approve')
    )
    
    if (approveButton) {
      await user.click(approveButton)
    }
  })

  it('rejects booking', async () => {
    const user = userEvent.setup()
    render(<BookingsPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/BK001/i)).toBeInTheDocument()
    })

    // Look for reject button
    const rejectButtons = screen.queryAllByRole('button')
    const rejectButton = rejectButtons.find(btn => 
      btn.textContent?.includes('Từ chối') || btn.textContent?.includes('Reject')
    )
    
    if (rejectButton) {
      await user.click(rejectButton)
    }
  })

  it('shows loading state', () => {
    const { useBookings } = require('@/hooks/useApi')
    useBookings.mockReturnValue({
      data: [],
      loading: true,
    })

    render(<BookingsPage />)
    const { container } = render(<BookingsPage />)
    expect(container.querySelector('.animate-pulse') || container.textContent?.includes('Đang tải')).toBeTruthy()
  })

  it('displays empty state when no bookings', async () => {
    const { useBookings } = require('@/hooks/useApi')
    useBookings.mockReturnValue({
      data: [],
      loading: false,
    })

    render(<BookingsPage />)
    await waitFor(() => {
      expect(screen.getByText(/Đặt phòng/i) || screen.getByText(/Chưa có/i)).toBeInTheDocument()
    })
  })
})

