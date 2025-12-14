import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import RoomTypesPage from '../page'

// Mock hooks
jest.mock('@/hooks/useApi', () => ({
  useRoomTypes: jest.fn(() => ({
    data: [
      { id: 1, name: 'Standard', code: 'STD' },
      { id: 2, name: 'Deluxe', code: 'DLX' },
    ],
    loading: false,
    refetch: jest.fn(),
  })),
}))

describe('AdminRoomTypesPage', () => {
  it('renders room types page title', async () => {
    render(<RoomTypesPage />)
    await waitFor(() => {
      expect(screen.getByText(/Loại phòng/i) || screen.getByText(/Room Types/i)).toBeInTheDocument()
    })
  })

  it('displays room types list', async () => {
    render(<RoomTypesPage />)
    await waitFor(() => {
      expect(screen.getByText(/Standard/i) || screen.getByText(/Deluxe/i)).toBeInTheDocument()
    })
  })
})

