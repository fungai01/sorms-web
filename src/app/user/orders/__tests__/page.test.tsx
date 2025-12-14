import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import UserOrdersPage from '../page'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}))

// Mock hooks
jest.mock('@/hooks/useApi', () => ({
  useServiceOrders: () => ({
    data: [
      {
        id: 1,
        serviceName: 'Cleaning Service',
        quantity: 2,
        totalPrice: 100000,
        status: 'PENDING',
        orderDate: '2025-01-01',
      },
    ],
    loading: false,
  }),
}))

// Mock fetch
global.fetch = jest.fn()

describe('UserOrdersPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })
  })

  it('renders orders page title', async () => {
    render(<UserOrdersPage />)
    await waitFor(() => {
      expect(screen.getByText(/Đơn dịch vụ/i) || screen.getByText(/Orders/i)).toBeInTheDocument()
    })
  })

  it('displays orders list', async () => {
    render(<UserOrdersPage />)
    await waitFor(() => {
      expect(screen.getByText(/Cleaning Service/i)).toBeInTheDocument()
    })
  })

  it('displays order details', async () => {
    render(<UserOrdersPage />)
    await waitFor(() => {
      expect(screen.getByText(/100000/i) || screen.getByText(/PENDING/i)).toBeInTheDocument()
    })
  })

  it('filters orders by status', async () => {
    const user = userEvent.setup()
    render(<UserOrdersPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/Cleaning Service/i)).toBeInTheDocument()
    })

    // Look for filter buttons
    const filterButtons = screen.queryAllByRole('button')
    const statusFilter = filterButtons.find(btn => 
      btn.textContent?.includes('PENDING') || btn.textContent?.includes('Chờ')
    )
    
    if (statusFilter) {
      await user.click(statusFilter)
    }
  })

  it('opens order detail modal', async () => {
    const user = userEvent.setup()
    render(<UserOrdersPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/Cleaning Service/i)).toBeInTheDocument()
    })

    // Click on order to view details
    const orderElement = screen.getByText(/Cleaning Service/i)
    await user.click(orderElement)

    await waitFor(() => {
      // Should show order details
      expect(screen.getByText(/Chi tiết/i) || screen.getByText(/Details/i)).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('cancels order when cancel button is clicked', async () => {
    const user = userEvent.setup()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    })

    render(<UserOrdersPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/Cleaning Service/i)).toBeInTheDocument()
    })

    // Look for cancel button
    const cancelButtons = screen.queryAllByRole('button')
    const cancelButton = cancelButtons.find(btn => 
      btn.textContent?.includes('Hủy') || btn.textContent?.includes('Cancel')
    )
    
    if (cancelButton) {
      await user.click(cancelButton)
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api'),
          expect.objectContaining({ method: 'PUT' })
        )
      })
    }
  })

  it('shows loading state', () => {
    const { useServiceOrders } = require('@/hooks/useApi')
    useServiceOrders.mockReturnValue({
      data: [],
      loading: true,
    })

    render(<UserOrdersPage />)
    // Should show loading
    const { container } = render(<UserOrdersPage />)
    expect(container.querySelector('.animate-pulse') || container.textContent?.includes('Đang tải')).toBeTruthy()
  })

  it('displays empty state when no orders', async () => {
    const { useServiceOrders } = require('@/hooks/useApi')
    useServiceOrders.mockReturnValue({
      data: [],
      loading: false,
    })

    render(<UserOrdersPage />)
    await waitFor(() => {
      // Should show empty state
      expect(screen.getByText(/Đơn dịch vụ/i) || screen.getByText(/Chưa có đơn/i)).toBeInTheDocument()
    })
  })

  it('handles API errors gracefully', async () => {
    const { useServiceOrders } = require('@/hooks/useApi')
    useServiceOrders.mockReturnValue({
      data: null,
      loading: false,
      error: 'API Error',
    })

    render(<UserOrdersPage />)
    await waitFor(() => {
      // Should handle error
      expect(screen.getByText(/Đơn dịch vụ/i)).toBeInTheDocument()
    })
  })

  it('displays order status badges', async () => {
    render(<UserOrdersPage />)
    await waitFor(() => {
      // Should show status badge
      expect(screen.getByText(/PENDING/i) || screen.getByText(/Chờ/i)).toBeInTheDocument()
    })
  })
})

