import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import RoomsPage from '../page'

// Mock hooks
jest.mock('@/hooks/useApi', () => ({
  useRooms: jest.fn(() => ({
    data: [
      { id: 1, code: 'R101', status: 'AVAILABLE' },
      { id: 2, code: 'R102', status: 'OCCUPIED' },
    ],
    loading: false,
  })),
}))

describe('OfficeRoomsPage', () => {
  it('renders rooms page title', async () => {
    render(<RoomsPage />)
    await waitFor(() => {
      expect(screen.getByText(/Phòng/i) || screen.getByText(/Rooms/i)).toBeInTheDocument()
    })
  })

  it('displays rooms list', async () => {
    render(<RoomsPage />)
    await waitFor(() => {
      expect(screen.getByText(/R101/i) || screen.getByText(/R102/i)).toBeInTheDocument()
    })
  })
})

