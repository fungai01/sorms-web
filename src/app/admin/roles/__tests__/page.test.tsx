import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import RolesPage from '../page'

// Mock fetch
global.fetch = jest.fn()

describe('AdminRolesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 1, name: 'Admin', code: 'ADMIN' },
        { id: 2, name: 'User', code: 'USER' },
      ],
    })
  })

  it('renders roles page title', async () => {
    render(<RolesPage />)
    await waitFor(() => {
      expect(screen.getByText(/Vai trò/i) || screen.getByText(/Roles/i)).toBeInTheDocument()
    })
  })

  it('displays roles list', async () => {
    render(<RolesPage />)
    await waitFor(() => {
      expect(screen.getByText(/Admin/i) || screen.getByText(/User/i)).toBeInTheDocument()
    })
  })
})

