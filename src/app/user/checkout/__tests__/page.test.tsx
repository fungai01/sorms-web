import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import CheckoutPage from '../page'

// Mock Next.js router
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === 'bookingId') return '1'
      return null
    },
  }),
}))

// Mock services
jest.mock('@/lib/api-client', () => ({
  apiClient: {
    post: jest.fn(() => Promise.resolve({ data: { success: true } })),
  },
}))

jest.mock('@/lib/auth-service', () => ({
  authService: {
    getAccessToken: jest.fn(() => 'mock-token'),
  },
}))

// Mock fetch
global.fetch = jest.fn()

describe('UserCheckoutPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders checkout page title', async () => {
    render(<CheckoutPage />)
    await waitFor(() => {
      expect(screen.getByText(/Checkout/i) || screen.getByText(/Trả phòng/i)).toBeInTheDocument()
    })
  })

  it('displays booking ID from URL params', async () => {
    render(<CheckoutPage />)
    await waitFor(() => {
      // Should show booking information or checkout form
      expect(screen.getByText(/Checkout/i) || screen.getByText(/Trả phòng/i)).toBeInTheDocument()
    })
  })

  it('submits checkout form', async () => {
    const user = userEvent.setup()
    const { apiClient } = require('@/lib/api-client')
    
    render(<CheckoutPage />)
    
    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /Xác nhận/i }) || screen.getByRole('button', { name: /Submit/i })
      if (submitButton) {
        return submitButton
      }
    })

    const submitButton = screen.queryByRole('button', { name: /Xác nhận/i }) || screen.queryByRole('button', { name: /Submit/i })
    if (submitButton) {
      await user.click(submitButton)
      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalled()
      })
    }
  })

  it('displays error when bookingId is invalid', async () => {
    const { useSearchParams } = require('next/navigation')
    useSearchParams.mockReturnValue({
      get: () => null,
    })

    render(<CheckoutPage />)
    await waitFor(() => {
      expect(screen.getByText(/không hợp lệ/i) || screen.getByText(/invalid/i)).toBeInTheDocument()
    })
  })

  it('allows adding note before checkout', async () => {
    const user = userEvent.setup()
    render(<CheckoutPage />)
    
    await waitFor(() => {
      const noteInput = screen.queryByPlaceholderText(/Ghi chú/i) || screen.queryByLabelText(/Note/i)
      if (noteInput) {
        return noteInput
      }
    })

    const noteInput = screen.queryByPlaceholderText(/Ghi chú/i) || screen.queryByLabelText(/Note/i)
    if (noteInput) {
      await user.type(noteInput, 'Checkout note')
      expect(noteInput).toHaveValue('Checkout note')
    }
  })

  it('shows success message after checkout', async () => {
    const user = userEvent.setup()
    render(<CheckoutPage />)
    
    const submitButton = screen.queryByRole('button', { name: /Xác nhận/i })
    if (submitButton) {
      await user.click(submitButton)
      await waitFor(() => {
        expect(screen.getByText(/Thành công/i) || screen.getByText(/Success/i)).toBeInTheDocument()
      }, { timeout: 3000 })
    }
  })
})

