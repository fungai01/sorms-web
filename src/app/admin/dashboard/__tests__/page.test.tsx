import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import AdminHome from '../page'

// Mock Next.js Link
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

// Mock useApi hooks
jest.mock('@/hooks/useApi', () => ({
  useBookings: () => ({ data: [] }),
  useRooms: () => ({ data: [] }),
  useUsers: () => ({ data: [] }),
}))

// Mock auth service
jest.mock('@/lib/auth-service', () => ({
  authService: {
    getAccessToken: jest.fn(() => 'mock-token'),
  },
}))

// Mock fetch
global.fetch = jest.fn()

describe('AdminDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock successful API responses
    ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/dashboard/occupancy')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ total: 10, occupied: 5 }),
        })
      }
      if (url.includes('/dashboard/bookings')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ pending: 3, series: [] }),
        })
      }
      if (url.includes('/dashboard/checkins')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ series: [] }),
        })
      }
      if (url.includes('/dashboard/payments')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ count: 5, sum: 1000000, series: [] }),
        })
      }
      if (url.includes('/dashboard/service-orders')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ top: [] }),
        })
      }
      if (url.includes('/dashboard/tasks')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ todo: 2, in_progress: 1, done: 5, cancelled: 0 }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      })
    })
  })

  it('renders dashboard title', async () => {
    render(<AdminHome />)
    await waitFor(() => {
      expect(screen.getByText(/ADMIN - Dashboard/i)).toBeInTheDocument()
    })
  })

  it('renders KPI cards', async () => {
    render(<AdminHome />)
    await waitFor(() => {
      expect(screen.getByText(/Tỉ lệ lấp đầy/i)).toBeInTheDocument()
      expect(screen.getByText(/Đặt phòng chờ/i)).toBeInTheDocument()
      expect(screen.getByText(/Doanh thu hôm nay/i)).toBeInTheDocument()
      expect(screen.getByText(/Công việc đang chờ/i)).toBeInTheDocument()
    })
  })

  it('renders date range selector', async () => {
    render(<AdminHome />)
    await waitFor(() => {
      expect(screen.getByText(/Từ ngày/i)).toBeInTheDocument()
      expect(screen.getByText(/Đến ngày/i)).toBeInTheDocument()
    })
  })

  it('renders chart sections', async () => {
    render(<AdminHome />)
    await waitFor(() => {
      expect(screen.getByText(/Tỉ lệ lấp đầy phòng/i)).toBeInTheDocument()
      expect(screen.getByText(/Trạng thái công việc/i)).toBeInTheDocument()
    })
  })

  it('renders quick action links', async () => {
    render(<AdminHome />)
    await waitFor(() => {
      expect(screen.getByText(/Truy cập nhanh/i)).toBeInTheDocument()
      expect(screen.getByText(/Đặt phòng/i)).toBeInTheDocument()
      expect(screen.getByText(/Thanh toán/i)).toBeInTheDocument()
      expect(screen.getByText(/Công việc/i)).toBeInTheDocument()
    })
  })

  it('displays loading state initially', () => {
    render(<AdminHome />)
    // Should show loading skeletons
    const { container } = render(<AdminHome />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('handles API errors gracefully', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'))
    
    render(<AdminHome />)
    
    await waitFor(() => {
      expect(screen.getByText(/Không tải được dữ liệu/i)).toBeInTheDocument()
    })
  })

  it('renders empty state when no data', async () => {
    ;(global.fetch as jest.Mock).mockImplementation(() => 
      Promise.resolve({
        ok: true,
        json: async () => ({ total: 0, occupied: 0, pending: 0, series: [] }),
      })
    )

    render(<AdminHome />)
    
    await waitFor(() => {
      expect(screen.getByText(/0\/0/i)).toBeInTheDocument()
    })
  })
})

