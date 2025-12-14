import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import StaffProfilesPage from '../page'

// Mock fetch
global.fetch = jest.fn()

describe('AdminStaffProfilesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 1, employeeId: 'EMP001', department: 'Housekeeping' },
        { id: 2, employeeId: 'EMP002', department: 'Maintenance' },
      ],
    })
  })

  it('renders staff profiles page title', async () => {
    render(<StaffProfilesPage />)
    await waitFor(() => {
      expect(screen.getByText(/Nhân viên/i) || screen.getByText(/Staff/i)).toBeInTheDocument()
    })
  })

  it('displays staff profiles list', async () => {
    render(<StaffProfilesPage />)
    await waitFor(() => {
      expect(screen.getByText(/EMP001/i) || screen.getByText(/Housekeeping/i)).toBeInTheDocument()
    })
  })
})

