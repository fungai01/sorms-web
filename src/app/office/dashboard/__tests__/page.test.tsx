import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import OfficeDashboard from '../page'

// Mock Next.js router
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock hooks
jest.mock('@/hooks/useApi', () => ({
  useBookings: () => ({
    data: [
      { id: 1, status: 'PENDING' },
      { id: 2, status: 'APPROVED' },
    ],
    loading: false,
  }),
  useRooms: () => ({
    data: [
      { id: 1, status: 'AVAILABLE' },
      { id: 2, status: 'OCCUPIED' },
      { id: 3, status: 'MAINTENANCE' },
    ],
    loading: false,
  }),
  useUsers: () => ({
    data: [{ id: 1, email: 'user@example.com' }],
  }),
}))

describe('OfficeDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders office dashboard title', async () => {
    render(<OfficeDashboard />)
    await waitFor(() => {
      expect(screen.getByText(/Dashboard/i)).toBeInTheDocument()
    })
  })

  it('displays booking statistics', async () => {
    render(<OfficeDashboard />)
    await waitFor(() => {
      expect(screen.getByText(/Đặt phòng/i)).toBeInTheDocument()
    })
  })

  it('displays room statistics', async () => {
    render(<OfficeDashboard />)
    await waitFor(() => {
      expect(screen.getByText(/Phòng/i)).toBeInTheDocument()
    })
  })

  it('renders quick action buttons', async () => {
    render(<OfficeDashboard />)
    await waitFor(() => {
      expect(screen.getByText(/Duyệt đặt phòng/i)).toBeInTheDocument()
      expect(screen.getByText(/Quản lý phòng/i)).toBeInTheDocument()
      expect(screen.getByText(/Báo cáo/i)).toBeInTheDocument()
    })
  })

  it('navigates to bookings page when clicking booking action', async () => {
    const user = userEvent.setup()
    render(<OfficeDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText(/Duyệt đặt phòng/i)).toBeInTheDocument()
    })

    const bookingButton = screen.getByText(/Duyệt đặt phòng/i)
    await user.click(bookingButton)

    expect(mockPush).toHaveBeenCalledWith('/office/bookings')
  })

  it('navigates to rooms page when clicking rooms action', async () => {
    const user = userEvent.setup()
    render(<OfficeDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText(/Quản lý phòng/i)).toBeInTheDocument()
    })

    const roomsButton = screen.getByText(/Quản lý phòng/i)
    await user.click(roomsButton)

    expect(mockPush).toHaveBeenCalledWith('/office/rooms')
  })

  it('navigates to reports page when clicking reports action', async () => {
    const user = userEvent.setup()
    render(<OfficeDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText(/Báo cáo/i)).toBeInTheDocument()
    })

    const reportsButton = screen.getByText(/Báo cáo/i)
    await user.click(reportsButton)

    expect(mockPush).toHaveBeenCalledWith('/office/reports')
  })

  it('displays pending bookings count', async () => {
    render(<OfficeDashboard />)
    await waitFor(() => {
      expect(screen.getByText(/1 yêu cầu chờ duyệt/i)).toBeInTheDocument()
    })
  })

  it('displays available rooms count', async () => {
    render(<OfficeDashboard />)
    await waitFor(() => {
      expect(screen.getByText(/1 phòng trống/i)).toBeInTheDocument()
    })
  })

  it('shows loading state', () => {
    const { useBookings, useRooms } = require('@/hooks/useApi')
    useBookings.mockReturnValue({ data: [], loading: true })
    useRooms.mockReturnValue({ data: [], loading: true })

    render(<OfficeDashboard />)
    // Should show loading
    const { container } = render(<OfficeDashboard />)
    expect(container.querySelector('.animate-pulse') || container.textContent?.includes('Đang tải')).toBeTruthy()
  })

  it('displays time range selector', async () => {
    render(<OfficeDashboard />)
    await waitFor(() => {
      expect(screen.getByText(/Hôm nay/i) || screen.getByText(/Tuần/i) || screen.getByText(/Tháng/i)).toBeInTheDocument()
    })
  })

  it('handles empty data gracefully', async () => {
    const { useBookings, useRooms } = require('@/hooks/useApi')
    useBookings.mockReturnValue({ data: [], loading: false })
    useRooms.mockReturnValue({ data: [], loading: false })

    render(<OfficeDashboard />)
    await waitFor(() => {
      expect(screen.getByText(/Dashboard/i)).toBeInTheDocument()
    })
  })
})

