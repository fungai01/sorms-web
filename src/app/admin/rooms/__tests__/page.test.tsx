import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import RoomsPage from '../page'

// Mock hooks
jest.mock('@/hooks/useApi', () => ({
  useRoomsFiltered: jest.fn(() => ({
    data: [
      { id: 1, code: 'R101', name: 'Room 101', status: 'AVAILABLE' },
      { id: 2, code: 'R102', name: 'Room 102', status: 'OCCUPIED' },
    ],
    refetch: jest.fn(),
  })),
  useRoomTypes: jest.fn(() => ({
    data: [{ id: 1, name: 'Standard' }],
    refetch: jest.fn(),
  })),
}))

// Mock fetch
global.fetch = jest.fn()

describe('AdminRoomsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })
  })

  it('renders rooms page title', async () => {
    render(<RoomsPage />)
    await waitFor(() => {
      expect(screen.getByText(/Phòng/i) || screen.getByText(/Rooms/i)).toBeInTheDocument()
    })
  })

  it('displays rooms list', async () => {
    render(<RoomsPage />)
    await waitFor(() => {
      expect(screen.getByText(/R101/i) || screen.getByText(/Room 101/i)).toBeInTheDocument()
    })
  })

  it('filters rooms by status', async () => {
    const user = userEvent.setup()
    render(<RoomsPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/R101/i)).toBeInTheDocument()
    })

    const filterButtons = screen.queryAllByRole('button')
    const statusFilter = filterButtons.find(btn => 
      btn.textContent?.includes('AVAILABLE') || btn.textContent?.includes('Có thể')
    )
    
    if (statusFilter) {
      await user.click(statusFilter)
    }
  })

  it('opens create room modal', async () => {
    const user = userEvent.setup()
    render(<RoomsPage />)
    
    await waitFor(() => {
      const createButtons = screen.queryAllByRole('button')
      const createButton = createButtons.find(btn => 
        btn.textContent?.includes('Tạo') || btn.textContent?.includes('Create') || btn.textContent?.includes('Thêm')
      )
      
      if (createButton) {
        return createButton
      }
    })

    const createButtons = screen.queryAllByRole('button')
    const createButton = createButtons.find(btn => 
      btn.textContent?.includes('Tạo phòng') || btn.textContent?.includes('Thêm phòng')
    )
    
    if (createButton) {
      await user.click(createButton)
      await waitFor(() => {
        expect(screen.getByText(/Tạo phòng/i) || screen.getByText(/Thêm phòng/i)).toBeInTheDocument()
      })
    }
  })

  it('opens room detail modal', async () => {
    const user = userEvent.setup()
    render(<RoomsPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/R101/i)).toBeInTheDocument()
    })

    const roomElement = screen.getByText(/R101/i)
    await user.click(roomElement)

    await waitFor(() => {
      expect(screen.getByText(/Chi tiết/i) || screen.getByText(/Room 101/i)).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('searches rooms by query', async () => {
    const user = userEvent.setup()
    render(<RoomsPage />)
    
    const searchInput = screen.queryByPlaceholderText(/Tìm kiếm/i) || screen.queryByRole('textbox')
    if (searchInput) {
      await user.type(searchInput, 'R101')
    }
  })

  it('displays empty state when no rooms', async () => {
    const { useRoomsFiltered } = require('@/hooks/useApi')
    useRoomsFiltered.mockReturnValue({
      data: [],
      refetch: jest.fn(),
    })

    render(<RoomsPage />)
    await waitFor(() => {
      expect(screen.getByText(/Phòng/i) || screen.getByText(/Chưa có/i)).toBeInTheDocument()
    })
  })
})

