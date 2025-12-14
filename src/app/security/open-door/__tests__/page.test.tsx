import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import OpenDoorPage from '../page'

// Mock fetch
global.fetch = jest.fn()

describe('SecurityOpenDoorPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    })
  })

  it('renders open door page title', async () => {
    render(<OpenDoorPage />)
    await waitFor(() => {
      expect(screen.getByText(/Mở cửa/i) || screen.getByText(/Open Door/i)).toBeInTheDocument()
    })
  })

  it('displays room input field', async () => {
    render(<OpenDoorPage />)
    await waitFor(() => {
      const roomInput = screen.getByPlaceholderText(/Phòng/i) || screen.getByLabelText(/Room/i)
      expect(roomInput).toBeInTheDocument()
    })
  })

  it('opens door when form is submitted', async () => {
    const user = userEvent.setup()
    render(<OpenDoorPage />)
    
    await waitFor(() => {
      const roomInput = screen.getByPlaceholderText(/Phòng/i) || screen.getByLabelText(/Room/i)
      if (roomInput) {
        return roomInput
      }
    })

    const roomInput = screen.getByPlaceholderText(/Phòng/i) || screen.getByLabelText(/Room/i)
    const submitButton = screen.getByRole('button', { name: /Mở cửa/i }) || screen.getByRole('button', { name: /Open/i })
    
    if (roomInput && submitButton) {
      await user.type(roomInput, 'R101')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })
    }
  })

  it('displays success message after opening door', async () => {
    const user = userEvent.setup()
    render(<OpenDoorPage />)
    
    const roomInput = screen.getByPlaceholderText(/Phòng/i) || screen.getByLabelText(/Room/i)
    const submitButton = screen.getByRole('button', { name: /Mở cửa/i })
    
    if (roomInput && submitButton) {
      await user.type(roomInput, 'R101')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Thành công/i) || screen.getByText(/Success/i)).toBeInTheDocument()
      }, { timeout: 3000 })
    }
  })

  it('displays error message on failure', async () => {
    const user = userEvent.setup()
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Failed'))

    render(<OpenDoorPage />)
    
    const roomInput = screen.getByPlaceholderText(/Phòng/i)
    const submitButton = screen.getByRole('button', { name: /Mở cửa/i })
    
    if (roomInput && submitButton) {
      await user.type(roomInput, 'R101')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Lỗi/i) || screen.getByText(/Error/i)).toBeInTheDocument()
      }, { timeout: 3000 })
    }
  })
})

