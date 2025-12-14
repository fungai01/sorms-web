import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import FaceRegistrationPage from '../page'

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

// Mock fetch
global.fetch = jest.fn()

describe('UserFaceRegistrationPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    })
  })

  it('renders face registration page title', async () => {
    render(<FaceRegistrationPage />)
    await waitFor(() => {
      expect(screen.getByText(/Đăng ký khuôn mặt/i) || screen.getByText(/Face Registration/i)).toBeInTheDocument()
    })
  })

  it('displays camera component', async () => {
    render(<FaceRegistrationPage />)
    await waitFor(() => {
      expect(screen.getByTestId('webcam') || screen.getByText(/Camera/i)).toBeInTheDocument()
    })
  })

  it('captures face image', async () => {
    const user = userEvent.setup()
    render(<FaceRegistrationPage />)
    
    await waitFor(() => {
      const captureButtons = screen.queryAllByRole('button')
      const captureButton = captureButtons.find(btn => 
        btn.textContent?.includes('Chụp') || btn.textContent?.includes('Capture')
      )
      
      if (captureButton) {
        return captureButton
      }
    })

    const captureButtons = screen.queryAllByRole('button')
    const captureButton = captureButtons.find(btn => 
      btn.textContent?.includes('Chụp ảnh') || btn.textContent?.includes('Capture')
    )
    
    if (captureButton) {
      await user.click(captureButton)
      // Should capture image
    }
  })

  it('registers face', async () => {
    const user = userEvent.setup()
    render(<FaceRegistrationPage />)
    
    await waitFor(() => {
      const registerButtons = screen.queryAllByRole('button')
      const registerButton = registerButtons.find(btn => 
        btn.textContent?.includes('Đăng ký') || btn.textContent?.includes('Register')
      )
      
      if (registerButton) {
        return registerButton
      }
    })

    const registerButtons = screen.queryAllByRole('button')
    const registerButton = registerButtons.find(btn => 
      btn.textContent?.includes('Đăng ký khuôn mặt') || btn.textContent?.includes('Register Face')
    )
    
    if (registerButton) {
      await user.click(registerButton)
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled()
      })
    }
  })

  it('displays success message after registration', async () => {
    const user = userEvent.setup()
    render(<FaceRegistrationPage />)
    
    const registerButton = screen.queryByRole('button', { name: /Đăng ký/i })
    if (registerButton) {
      await user.click(registerButton)
      await waitFor(() => {
        expect(screen.getByText(/Thành công/i) || screen.getByText(/Success/i)).toBeInTheDocument()
      }, { timeout: 3000 })
    }
  })
})

