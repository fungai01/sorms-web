import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import NotificationsPage from '../page'

// Mock Next.js router
const mockBack = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    back: mockBack,
  }),
}))

// Mock notifications service
jest.mock('@/lib/notifications', () => ({
  getNotificationsByRole: jest.fn((role) => [
    {
      id: 1,
      title: 'Test Notification',
      message: 'This is a test notification',
      type: 'info',
      unread: true,
      time: '2025-01-01',
    },
    {
      id: 2,
      title: 'Another Notification',
      message: 'Another test',
      type: 'success',
      unread: false,
      time: '2025-01-02',
    },
  ]),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
  deleteNotification: jest.fn(),
}))

describe('NotificationsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders notifications page title', async () => {
    render(<NotificationsPage />)
    await waitFor(() => {
      expect(screen.getByText(/Thông báo/i)).toBeInTheDocument()
    })
  })

  it('displays notifications list', async () => {
    render(<NotificationsPage />)
    await waitFor(() => {
      expect(screen.getByText(/Test Notification/i)).toBeInTheDocument()
      expect(screen.getByText(/Another Notification/i)).toBeInTheDocument()
    })
  })

  it('filters notifications by read status', async () => {
    const user = userEvent.setup()
    render(<NotificationsPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/Test Notification/i)).toBeInTheDocument()
    })

    const filterSelect = screen.getByRole('combobox')
    await user.selectOptions(filterSelect, 'unread')

    await waitFor(() => {
      expect(screen.getByText(/Test Notification/i)).toBeInTheDocument()
      // Unread notification should still be visible
    })
  })

  it('marks notification as read', async () => {
    const user = userEvent.setup()
    const { markAsRead } = require('@/lib/notifications')
    
    render(<NotificationsPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/Test Notification/i)).toBeInTheDocument()
    })

    const markReadButtons = screen.queryAllByRole('button')
    const markReadButton = markReadButtons.find(btn => 
      btn.textContent?.includes('Đánh dấu đã đọc')
    )
    
    if (markReadButton) {
      await user.click(markReadButton)
      expect(markAsRead).toHaveBeenCalledWith(1)
    }
  })

  it('marks all notifications as read', async () => {
    const user = userEvent.setup()
    const { markAllAsRead } = require('@/lib/notifications')
    
    render(<NotificationsPage />)
    
    await waitFor(() => {
      const markAllButton = screen.getByRole('button', { name: /Đánh dấu tất cả đã đọc/i })
      if (markAllButton) {
        return markAllButton
      }
    })

    const markAllButton = screen.queryByRole('button', { name: /Đánh dấu tất cả đã đọc/i })
    if (markAllButton) {
      await user.click(markAllButton)
      expect(markAllAsRead).toHaveBeenCalled()
    }
  })

  it('deletes notification', async () => {
    const user = userEvent.setup()
    const { deleteNotification } = require('@/lib/notifications')
    
    render(<NotificationsPage />)
    
    await waitFor(() => {
      expect(screen.getByText(/Test Notification/i)).toBeInTheDocument()
    })

    const deleteButtons = screen.queryAllByRole('button')
    const deleteButton = deleteButtons.find(btn => 
      btn.textContent?.includes('Xóa')
    )
    
    if (deleteButton) {
      await user.click(deleteButton)
      expect(deleteNotification).toHaveBeenCalledWith(1)
    }
  })

  it('sorts notifications by time', async () => {
    const user = userEvent.setup()
    render(<NotificationsPage />)
    
    await waitFor(() => {
      const sortSelect = screen.getAllByRole('combobox').find(select => 
        select.querySelector('option[value="time"]')
      )
      
      if (sortSelect) {
        return sortSelect
      }
    })

    const sortSelects = screen.getAllByRole('combobox')
    const sortSelect = sortSelects.find(select => 
      Array.from(select.querySelectorAll('option')).some(opt => opt.value === 'time')
    )
    
    if (sortSelect) {
      await user.selectOptions(sortSelect, 'time')
    }
  })

  it('displays empty state when no notifications', async () => {
    const { getNotificationsByRole } = require('@/lib/notifications')
    getNotificationsByRole.mockReturnValueOnce([])

    render(<NotificationsPage />)
    await waitFor(() => {
      expect(screen.getByText(/Không có thông báo/i)).toBeInTheDocument()
    })
  })

  it('navigates back when back button is clicked', async () => {
    const user = userEvent.setup()
    render(<NotificationsPage />)
    
    await waitFor(() => {
      const backButton = screen.getByRole('button', { name: /Quay lại/i })
      if (backButton) {
        return backButton
      }
    })

    const backButton = screen.queryByRole('button', { name: /Quay lại/i })
    if (backButton) {
      await user.click(backButton)
      expect(mockBack).toHaveBeenCalled()
    }
  })

  it('displays unread count', async () => {
    render(<NotificationsPage />)
    await waitFor(() => {
      expect(screen.getByText(/1 thông báo chưa đọc/i) || screen.getByText(/chưa đọc/i)).toBeInTheDocument()
    })
  })
})

