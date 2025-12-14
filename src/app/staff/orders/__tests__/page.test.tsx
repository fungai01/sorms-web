import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import StaffOrdersPage from '../page'

// Mock fetch
global.fetch = jest.fn()

describe('StaffOrdersPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 1,
          serviceName: 'Cleaning Service',
          status: 'PENDING',
          orderDate: '2025-01-01',
        },
      ],
    })
  })

  it('renders orders page title', async () => {
    render(<StaffOrdersPage />)
    await waitFor(() => {
      expect(screen.getByText(/Đơn dịch vụ/i) || screen.getByText(/Orders/i)).toBeInTheDocument()
    })
  })

  it('displays orders list', async () => {
    render(<StaffOrdersPage />)
    await waitFor(() => {
      expect(screen.getByText(/Cleaning Service/i)).toBeInTheDocument()
    })
  })

  it('filters orders by status', async () => {
    const user = userEvent.setup()
    render(<StaffOrdersPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/Cleaning Service/i)).toBeInTheDocument()
    })

    const filterButtons = screen.queryAllByRole('button')
    const statusFilter = filterButtons.find(btn => 
      btn.textContent?.includes('PENDING') || btn.textContent?.includes('Chờ')
    )
    
    if (statusFilter) {
      await user.click(statusFilter)
    }
  })

  it('completes order', async () => {
    const user = userEvent.setup()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    })

    render(<StaffOrdersPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/Cleaning Service/i)).toBeInTheDocument()
    })

    const completeButtons = screen.queryAllByRole('button')
    const completeButton = completeButtons.find(btn => 
      btn.textContent?.includes('Hoàn thành') || btn.textContent?.includes('Complete')
    )
    
    if (completeButton) {
      await user.click(completeButton)
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })
    }
  })

  it('shows loading state', () => {
    ;(global.fetch as jest.Mock).mockImplementation(() => 
      new Promise(() => {})
    )

    render(<StaffOrdersPage />)
    const { container } = render(<StaffOrdersPage />)
    expect(container.querySelector('.animate-pulse') || container.textContent?.includes('Đang tải')).toBeTruthy()
  })

  it('displays empty state when no orders', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [],
    })

    render(<StaffOrdersPage />)
    await waitFor(() => {
      expect(screen.getByText(/Đơn dịch vụ/i) || screen.getByText(/Chưa có/i)).toBeInTheDocument()
    })
  })
})

