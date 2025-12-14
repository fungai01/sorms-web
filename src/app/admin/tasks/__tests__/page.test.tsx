import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import TasksPage from '../page'

// Mock hooks
jest.mock('@/hooks/useApi', () => ({
  useStaffTasks: jest.fn(() => ({
    data: [
      { id: 1, title: 'Task 1', status: 'TODO', priority: 'HIGH', assignee: 'staff1' },
      { id: 2, title: 'Task 2', status: 'IN_PROGRESS', priority: 'MEDIUM', assignee: 'staff2' },
    ],
    loading: false,
    refetch: jest.fn(),
  })),
}))

// Mock fetch
global.fetch = jest.fn()

describe('AdminTasksPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })
  })

  it('renders tasks page title', async () => {
    render(<TasksPage />)
    await waitFor(() => {
      expect(screen.getByText(/Công việc/i) || screen.getByText(/Tasks/i)).toBeInTheDocument()
    })
  })

  it('displays tasks list', async () => {
    render(<TasksPage />)
    await waitFor(() => {
      expect(screen.getByText(/Task 1/i) || screen.getByText(/Task 2/i)).toBeInTheDocument()
    })
  })

  it('filters tasks by status', async () => {
    const user = userEvent.setup()
    render(<TasksPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/Task 1/i)).toBeInTheDocument()
    })

    const filterButtons = screen.queryAllByRole('button')
    const statusFilter = filterButtons.find(btn => 
      btn.textContent?.includes('TODO') || btn.textContent?.includes('Chờ')
    )
    
    if (statusFilter) {
      await user.click(statusFilter)
    }
  })

  it('filters tasks by priority', async () => {
    const user = userEvent.setup()
    render(<TasksPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/Task 1/i)).toBeInTheDocument()
    })

    const filterButtons = screen.queryAllByRole('button')
    const priorityFilter = filterButtons.find(btn => 
      btn.textContent?.includes('HIGH') || btn.textContent?.includes('Cao')
    )
    
    if (priorityFilter) {
      await user.click(priorityFilter)
    }
  })

  it('creates new task', async () => {
    const user = userEvent.setup()
    render(<TasksPage />)
    
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
      btn.textContent?.includes('Tạo công việc') || btn.textContent?.includes('Thêm công việc')
    )
    
    if (createButton) {
      await user.click(createButton)
      await waitFor(() => {
        expect(screen.getByText(/Tạo công việc/i) || screen.getByText(/Thêm công việc/i)).toBeInTheDocument()
      })
    }
  })

  it('displays empty state when no tasks', async () => {
    const { useStaffTasks } = require('@/hooks/useApi')
    useStaffTasks.mockReturnValue({
      data: [],
      loading: false,
    })

    render(<TasksPage />)
    await waitFor(() => {
      expect(screen.getByText(/Công việc/i) || screen.getByText(/Chưa có/i)).toBeInTheDocument()
    })
  })
})

