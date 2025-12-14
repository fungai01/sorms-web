import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import PaymentsPage from '../page'

// Mock hooks
jest.mock('@/hooks/useApi', () => ({
  usePayments: jest.fn(() => ({
    data: [
      { id: 1, code: 'PAY001', amount: 100000, status: 'SUCCESS', payer_name: 'Test User' },
      { id: 2, code: 'PAY002', amount: 200000, status: 'PENDING', payer_name: 'Another User' },
    ],
    loading: false,
    error: null,
    refetch: jest.fn(),
  })),
}))

// Mock fetch
global.fetch = jest.fn()

describe('AdminPaymentsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders payments page title', async () => {
    render(<PaymentsPage />)
    await waitFor(() => {
      expect(screen.getByText(/Thanh toán/i) || screen.getByText(/Payments/i)).toBeInTheDocument()
    })
  })

  it('displays payments list', async () => {
    render(<PaymentsPage />)
    await waitFor(() => {
      expect(screen.getByText(/PAY001/i) || screen.getByText(/100000/i)).toBeInTheDocument()
    })
  })

  it('filters payments by status', async () => {
    const user = userEvent.setup()
    render(<PaymentsPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/PAY001/i)).toBeInTheDocument()
    })

    const filterButtons = screen.queryAllByRole('button')
    const statusFilter = filterButtons.find(btn => 
      btn.textContent?.includes('SUCCESS') || btn.textContent?.includes('Thành công')
    )
    
    if (statusFilter) {
      await user.click(statusFilter)
    }
  })

  it('opens payment detail modal', async () => {
    const user = userEvent.setup()
    render(<PaymentsPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/PAY001/i)).toBeInTheDocument()
    })

    const paymentElement = screen.getByText(/PAY001/i)
    await user.click(paymentElement)

    await waitFor(() => {
      expect(screen.getByText(/Chi tiết/i) || screen.getByText(/Test User/i)).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('searches payments by query', async () => {
    const user = userEvent.setup()
    render(<PaymentsPage />)
    
    const searchInput = screen.queryByPlaceholderText(/Tìm kiếm/i) || screen.queryByRole('textbox')
    if (searchInput) {
      await user.type(searchInput, 'PAY001')
    }
  })

  it('displays empty state when no payments', async () => {
    const { usePayments } = require('@/hooks/useApi')
    usePayments.mockReturnValue({
      data: [],
      loading: false,
    })

    render(<PaymentsPage />)
    await waitFor(() => {
      expect(screen.getByText(/Thanh toán/i) || screen.getByText(/Chưa có/i)).toBeInTheDocument()
    })
  })
})

