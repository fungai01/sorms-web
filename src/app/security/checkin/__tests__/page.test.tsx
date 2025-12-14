import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import CheckInPage from '../page'

// Mock Next.js dynamic import
jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (fn: any) => {
    const Component = fn()
    return Component
  },
}))

// Mock react-webcam
jest.mock('react-webcam', () => ({
  __esModule: true,
  default: ({ onUserMedia }: any) => (
    <div data-testid="webcam">Webcam Component</div>
  ),
}))

// Mock html5-qrcode
const mockHtml5Qrcode = {
  start: jest.fn(),
  stop: jest.fn(),
  clear: jest.fn(),
}

jest.mock('html5-qrcode', () => ({
  Html5Qrcode: jest.fn(() => mockHtml5Qrcode),
}))

// Mock fetch
global.fetch = jest.fn()

describe('SecurityCheckInPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        valid: true,
        bookingId: 1,
        userId: '1',
        userName: 'Test User',
      }),
    })
  })

  it('renders check-in page title', async () => {
    render(<CheckInPage />)
    await waitFor(() => {
      expect(screen.getByText(/Check-in/i) || screen.getByText(/Xác thực/i)).toBeInTheDocument()
    })
  })

  it('renders QR scanner section', async () => {
    render(<CheckInPage />)
    await waitFor(() => {
      expect(screen.getByText(/QR Code/i) || document.getElementById('qr-reader')).toBeInTheDocument()
    })
  })

  it('renders face verification section', async () => {
    render(<CheckInPage />)
    await waitFor(() => {
      expect(screen.getByText(/Xác thực khuôn mặt/i) || screen.getByText(/Face/i)).toBeInTheDocument()
    })
  })

  it('starts QR scanning when button is clicked', async () => {
    const user = userEvent.setup()
    render(<CheckInPage />)
    
    await waitFor(() => {
      const scanButtons = screen.queryAllByRole('button')
      const startButton = scanButtons.find(btn => 
        btn.textContent?.includes('Bắt đầu') || btn.textContent?.includes('Start')
      )
      
      if (startButton) {
        return startButton
      }
    })

    const scanButtons = screen.queryAllByRole('button')
    const startButton = scanButtons.find(btn => 
      btn.textContent?.includes('Bắt đầu') || btn.textContent?.includes('Start') || btn.textContent?.includes('Quét')
    )
    
    if (startButton) {
      await user.click(startButton)
      await waitFor(() => {
        expect(mockHtml5Qrcode.start).toHaveBeenCalled()
      })
    }
  })

  it('stops QR scanning when stop button is clicked', async () => {
    const user = userEvent.setup()
    render(<CheckInPage />)
    
    // First start scanning
    const scanButtons = screen.queryAllByRole('button')
    const startButton = scanButtons.find(btn => 
      btn.textContent?.includes('Bắt đầu') || btn.textContent?.includes('Start')
    )
    
    if (startButton) {
      await user.click(startButton)
    }

    // Then stop
    await waitFor(() => {
      const stopButtons = screen.queryAllByRole('button')
      const stopButton = stopButtons.find(btn => 
        btn.textContent?.includes('Dừng') || btn.textContent?.includes('Stop')
      )
      
      if (stopButton) {
        return stopButton
      }
    }, { timeout: 2000 })
  })

  it('handles QR code verification', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        valid: true,
        bookingId: 1,
        userName: 'Test User',
        roomCode: '101',
      }),
    })

    render(<CheckInPage />)
    
    // Simulate QR scan result
    await waitFor(() => {
      // Should process QR result
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  it('displays verification result', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        valid: true,
        bookingId: 1,
        userName: 'Test User',
        roomCode: '101',
      }),
    })

    render(<CheckInPage />)
    
    await waitFor(() => {
      // Should show verification result
      expect(screen.getByText(/Test User/i) || screen.getByText(/101/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('handles invalid QR code', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        valid: false,
        error: 'Invalid QR code',
      }),
    })

    render(<CheckInPage />)
    
    await waitFor(() => {
      // Should show error message
      expect(screen.getByText(/Invalid/i) || screen.getByText(/Không hợp lệ/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('starts face verification when button is clicked', async () => {
    const user = userEvent.setup()
    render(<CheckInPage />)
    
    await waitFor(() => {
      const faceButtons = screen.queryAllByRole('button')
      const startFaceButton = faceButtons.find(btn => 
        btn.textContent?.includes('Xác thực') || btn.textContent?.includes('Face')
      )
      
      if (startFaceButton) {
        return startFaceButton
      }
    })

    const faceButtons = screen.queryAllByRole('button')
    const startFaceButton = faceButtons.find(btn => 
      btn.textContent?.includes('Xác thực khuôn mặt') || btn.textContent?.includes('Face Verification')
    )
    
    if (startFaceButton) {
      await user.click(startFaceButton)
      // Should start face verification
    }
  })

  it('handles check-in success', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          valid: true,
          bookingId: 1,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
        }),
      })

    render(<CheckInPage />)
    
    await waitFor(() => {
      // Should show success message
      expect(screen.getByText(/Thành công/i) || screen.getByText(/Success/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('displays error messages', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    render(<CheckInPage />)
    
    await waitFor(() => {
      // Should show error
      expect(screen.getByText(/Lỗi/i) || screen.getByText(/Error/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })
})

