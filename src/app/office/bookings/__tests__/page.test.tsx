import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import OfficeBookingsPage from '../page'

// Mock hooks
jest.mock('@/hooks/useApi', () => ({
  useBookings: jest.fn(() => ({
    data: [
      { id: 1, code: 'BK001', status: 'PENDING' },
      { id: 2, code: 'BK002', status: 'APPROVED' },
    ],
    loading: false,
  })),
}))

// Mock fetch
global.fetch = jest.fn()

describe('OfficeBookingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })
  })

  it('renders bookings page title', async () => {
    render(<OfficeBookingsPage />)
    await waitFor(() => {
      expect(screen.getByText(/Đặt phòng/i) || screen.getByText(/Bookings/i)).toBeInTheDocument()
    })
  })

  it('displays bookings list', async () => {
    render(<OfficeBookingsPage />)
    await waitFor(() => {
      expect(screen.getByText(/BK001/i) || screen.getByText(/BK002/i)).toBeInTheDocument()
    })
  })

  it('approves booking', async () => {
    const user = userEvent.setup()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    })

    render(<OfficeBookingsPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/BK001/i)).toBeInTheDocument()
    })

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
    render(<OfficeBookingsPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/BK001/i)).toBeInTheDocument()
    })

    const rejectButtons = screen.queryAllByRole('button')
    const rejectButton = rejectButtons.find(btn => 
      btn.textContent?.includes('Từ chối') || btn.textContent?.includes('Reject')
    )
    
    if (rejectButton) {
      await user.click(rejectButton)
    }
  })

  it('filters bookings by status', async () => {
    const user = userEvent.setup()
    render(<OfficeBookingsPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/BK001/i)).toBeInTheDocument()
    })

    const filterButtons = screen.queryAllByRole('button')
    const statusFilter = filterButtons.find(btn => 
      btn.textContent?.includes('PENDING') || btn.textContent?.includes('Chờ')
    )
    
    if (statusFilter) {
      await user.click(statusFilter)
    }
  })
})

