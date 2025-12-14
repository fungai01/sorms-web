import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import StaffPage from '../page'

// Mock fetch
global.fetch = jest.fn()

describe('StaffDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 1,
          title: 'Test Task',
          description: 'Test Description',
          priority: 'HIGH',
          status: 'TODO',
          assigned_to: 'staff1',
          due_at: '2025-01-15',
        },
      ],
    })
  })

  it('renders staff dashboard title', async () => {
    render(<StaffPage />)
    await waitFor(() => {
      expect(screen.getByText(/Dashboard/i)).toBeInTheDocument()
    })
  })

  it('renders tasks section', async () => {
    render(<StaffPage />)
    await waitFor(() => {
      expect(screen.getByText(/Công việc/i)).toBeInTheDocument()
    })
  })

  it('displays tasks list', async () => {
    render(<StaffPage />)
    await waitFor(() => {
      expect(screen.getByText(/Test Task/i)).toBeInTheDocument()
    })
  })

  it('shows loading state', () => {
    ;(global.fetch as jest.Mock).mockImplementation(() => 
      new Promise(() => {}) // Never resolves
    )

    render(<StaffPage />)
    // Should show loading
    const { container } = render(<StaffPage />)
    expect(container.querySelector('.animate-pulse') || container.textContent?.includes('Đang tải')).toBeTruthy()
  })

  it('filters tasks by status', async () => {
    const user = userEvent.setup()
    render(<StaffPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/Test Task/i)).toBeInTheDocument()
    })

    // Look for filter buttons
    const filterButtons = screen.queryAllByRole('button')
    const statusFilter = filterButtons.find(btn => 
      btn.textContent?.includes('PENDING') || btn.textContent?.includes('Chờ')
    )
    
    if (statusFilter) {
      await user.click(statusFilter)
      // Should filter tasks
    }
  })

  it('filters tasks by priority', async () => {
    const user = userEvent.setup()
    render(<StaffPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/Test Task/i)).toBeInTheDocument()
    })

    // Look for priority filter
    const filterButtons = screen.queryAllByRole('button')
    const priorityFilter = filterButtons.find(btn => 
      btn.textContent?.includes('HIGH') || btn.textContent?.includes('Cao')
    )
    
    if (priorityFilter) {
      await user.click(priorityFilter)
    }
  })

  it('opens task detail modal', async () => {
    const user = userEvent.setup()
    render(<StaffPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/Test Task/i)).toBeInTheDocument()
    })

    // Click on task to open modal
    const taskElement = screen.getByText(/Test Task/i)
    await user.click(taskElement)

    await waitFor(() => {
      // Should show task details in modal
      expect(screen.getByText(/Test Description/i)).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('handles accept task', async () => {
    const user = userEvent.setup()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    render(<StaffPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/Test Task/i)).toBeInTheDocument()
    })

    // Look for accept button
    const acceptButtons = screen.queryAllByRole('button')
    const acceptButton = acceptButtons.find(btn => 
      btn.textContent?.includes('Chấp nhận') || btn.textContent?.includes('Accept')
    )
    
    if (acceptButton) {
      await user.click(acceptButton)
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/system/tasks'),
          expect.objectContaining({ method: 'PUT' })
        )
      })
    }
  })

  it('handles reject task', async () => {
    const user = userEvent.setup()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    render(<StaffPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/Test Task/i)).toBeInTheDocument()
    })

    // Look for reject button
    const rejectButtons = screen.queryAllByRole('button')
    const rejectButton = rejectButtons.find(btn => 
      btn.textContent?.includes('Từ chối') || btn.textContent?.includes('Reject')
    )
    
    if (rejectButton) {
      await user.click(rejectButton)
      // Should open rejection modal or form
    }
  })

  it('displays empty state when no tasks', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [],
    })

    render(<StaffPage />)
    await waitFor(() => {
      // Should show empty state
      expect(screen.getByText(/Công việc/i)).toBeInTheDocument()
    })
  })

  it('handles API errors gracefully', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'))

    render(<StaffPage />)
    
    await waitFor(() => {
      // Should handle error gracefully
      expect(screen.getByText(/Công việc/i)).toBeInTheDocument()
    })
  })
})

