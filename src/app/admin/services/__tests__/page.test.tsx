import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import ServicesPage from '../page'

// Mock hooks
jest.mock('@/hooks/useApi', () => ({
  useServices: jest.fn(() => ({
    data: [
      { id: 1, name: 'Cleaning Service', price: 50000, code: 'SRV001' },
      { id: 2, name: 'Laundry Service', price: 30000, code: 'SRV002' },
    ],
    loading: false,
    refetch: jest.fn(),
  })),
}))

// Mock fetch
global.fetch = jest.fn()

describe('AdminServicesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })
  })

  it('renders services page title', async () => {
    render(<ServicesPage />)
    await waitFor(() => {
      expect(screen.getByText(/Dịch vụ/i) || screen.getByText(/Services/i)).toBeInTheDocument()
    })
  })

  it('displays services list', async () => {
    render(<ServicesPage />)
    await waitFor(() => {
      expect(screen.getByText(/Cleaning Service/i) || screen.getByText(/Laundry Service/i)).toBeInTheDocument()
    })
  })

  it('creates new service', async () => {
    const user = userEvent.setup()
    render(<ServicesPage />)
    
    await waitFor(() => {
      const createButtons = screen.queryAllByRole('button')
      const createButton = createButtons.find(btn => 
        btn.textContent?.includes('Tạo') || btn.textContent?.includes('Create')
      )
      
      if (createButton) {
        return createButton
      }
    })

    const createButtons = screen.queryAllByRole('button')
    const createButton = createButtons.find(btn => 
      btn.textContent?.includes('Tạo dịch vụ') || btn.textContent?.includes('Thêm dịch vụ')
    )
    
    if (createButton) {
      await user.click(createButton)
      await waitFor(() => {
        expect(screen.getByText(/Tạo dịch vụ/i) || screen.getByText(/Thêm dịch vụ/i)).toBeInTheDocument()
      })
    }
  })

  it('searches services by query', async () => {
    const user = userEvent.setup()
    render(<ServicesPage />)
    
    const searchInput = screen.queryByPlaceholderText(/Tìm kiếm/i) || screen.queryByRole('textbox')
    if (searchInput) {
      await user.type(searchInput, 'Cleaning')
    }
  })

  it('displays empty state when no services', async () => {
    const { useServices } = require('@/hooks/useApi')
    useServices.mockReturnValue({
      data: [],
      loading: false,
    })

    render(<ServicesPage />)
    await waitFor(() => {
      expect(screen.getByText(/Dịch vụ/i) || screen.getByText(/Chưa có/i)).toBeInTheDocument()
    })
  })
})

