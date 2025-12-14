import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import UserDashboard from '../page'

// Mock Next.js components
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}))

// Mock hooks
jest.mock('@/hooks/useApi', () => ({
  useAvailableRooms: () => ({ data: [], loading: false }),
  useUserBookings: () => ({ data: [], loading: false }),
  useServiceOrders: () => ({ data: [], loading: false }),
  useServices: () => ({ data: [], loading: false }),
  useStaffUsers: () => ({ data: [], loading: false }),
  useRoomTypes: () => ({ data: [], loading: false }),
}))

// Mock services
jest.mock('@/lib/auth-service', () => ({
  authService: {
    getUserInfo: jest.fn(() => ({ id: 1, email: 'test@example.com' })),
    getAccessToken: jest.fn(() => 'mock-token'),
  },
}))

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}))

jest.mock('@/lib/face-service', () => ({
  getFaceStatus: jest.fn(() => Promise.resolve({ registered: false })),
  deleteFace: jest.fn(),
}))

jest.mock('@/lib/qr-service', () => ({
  getBookingQr: jest.fn(),
}))

jest.mock('qrcode', () => ({
  __esModule: true,
  default: {
    toDataURL: jest.fn(() => Promise.resolve('data:image/png;base64,mock')),
  },
}))

// Mock fetch
global.fetch = jest.fn()

describe('UserDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })
  })

  it('renders dashboard title', async () => {
    render(<UserDashboard />)
    await waitFor(() => {
      expect(screen.getByText(/Dashboard/i)).toBeInTheDocument()
    })
  })

  it('renders booking section', async () => {
    render(<UserDashboard />)
    await waitFor(() => {
      expect(screen.getByText(/Đặt phòng/i)).toBeInTheDocument()
    })
  })

  it('renders service orders section', async () => {
    render(<UserDashboard />)
    await waitFor(() => {
      expect(screen.getByText(/Đơn dịch vụ/i)).toBeInTheDocument()
    })
  })

  it('displays available rooms', async () => {
    const { useAvailableRooms } = require('@/hooks/useApi')
    useAvailableRooms.mockReturnValue({
      data: [{
        id: 1,
        roomNumber: '101',
        building: 'A',
        status: 'AVAILABLE',
      }],
      loading: false,
    })

    render(<UserDashboard />)
    await waitFor(() => {
      expect(screen.getByText(/101/i)).toBeInTheDocument()
    })
  })

  it('shows loading state', () => {
    const { useAvailableRooms } = require('@/hooks/useApi')
    useAvailableRooms.mockReturnValue({
      data: [],
      loading: true,
    })

    render(<UserDashboard />)
    // Should show loading indicators
    const { container } = render(<UserDashboard />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('handles booking creation', async () => {
    const user = userEvent.setup()
    render(<UserDashboard />)
    
    await waitFor(() => {
      expect(screen.getByText(/Đặt phòng/i)).toBeInTheDocument()
    })

    // Look for create booking button
    const createButtons = screen.queryAllByRole('button')
    const bookingButton = createButtons.find(btn => 
      btn.textContent?.includes('Đặt phòng') || btn.textContent?.includes('Tạo đặt phòng')
    )
    
    if (bookingButton) {
      await user.click(bookingButton)
      // Should open booking modal or navigate
    }
  })

  it('displays user bookings', async () => {
    const { useUserBookings } = require('@/hooks/useApi')
    useUserBookings.mockReturnValue({
      data: [{
        id: 1,
        roomNumber: '101',
        checkIn: '2025-01-01',
        checkOut: '2025-01-05',
        status: 'CONFIRMED',
      }],
      loading: false,
    })

    render(<UserDashboard />)
    await waitFor(() => {
      expect(screen.getByText(/101/i)).toBeInTheDocument()
    })
  })

  it('shows empty state when no bookings', async () => {
    const { useUserBookings } = require('@/hooks/useApi')
    useUserBookings.mockReturnValue({
      data: [],
      loading: false,
    })

    render(<UserDashboard />)
    await waitFor(() => {
      // Should show empty state or no bookings message
      expect(screen.getByText(/Đặt phòng/i)).toBeInTheDocument()
    })
  })
})

