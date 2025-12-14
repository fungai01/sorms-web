import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import ServiceOrdersPage from '../page'

// Mock hooks
jest.mock('@/hooks/useApi', () => ({
  useServiceOrders: jest.fn(() => ({
    data: [
      { id: 1, serviceName: 'Cleaning', status: 'PENDING' },
      { id: 2, serviceName: 'Laundry', status: 'COMPLETED' },
    ],
    loading: false,
  })),
}))

describe('AdminServiceOrdersPage', () => {
  it('renders service orders page title', async () => {
    render(<ServiceOrdersPage />)
    await waitFor(() => {
      expect(screen.getByText(/Đơn dịch vụ/i) || screen.getByText(/Service Orders/i)).toBeInTheDocument()
    })
  })

  it('displays service orders list', async () => {
    render(<ServiceOrdersPage />)
    await waitFor(() => {
      expect(screen.getByText(/Cleaning/i) || screen.getByText(/Laundry/i)).toBeInTheDocument()
    })
  })
})

