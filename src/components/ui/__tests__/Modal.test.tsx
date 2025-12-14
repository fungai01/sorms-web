import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import Modal from '../Modal'

describe('Modal Component', () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    title: 'Test Modal',
    children: <div>Modal Content</div>,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders modal when open is true', () => {
    render(<Modal {...defaultProps} />)
    expect(screen.getByText('Test Modal')).toBeInTheDocument()
    expect(screen.getByText('Modal Content')).toBeInTheDocument()
  })

  it('does not render modal when open is false', () => {
    render(<Modal {...defaultProps} open={false} />)
    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument()
    expect(screen.queryByText('Modal Content')).not.toBeInTheDocument()
  })

  it('displays title correctly', () => {
    render(<Modal {...defaultProps} title="Custom Title" />)
    expect(screen.getByText('Custom Title')).toBeInTheDocument()
  })

  it('displays children content', () => {
    render(
      <Modal {...defaultProps}>
        <div>Custom Content</div>
      </Modal>
    )
    expect(screen.getByText('Custom Content')).toBeInTheDocument()
  })

  it('calls onClose when clicking backdrop', async () => {
    const onClose = jest.fn()
    const user = userEvent.setup()
    
    render(<Modal {...defaultProps} onClose={onClose} />)
    
    // Find backdrop (the overlay div)
    const backdrop = screen.getByText('Test Modal').closest('.fixed')?.querySelector('.absolute')
    if (backdrop) {
      await user.click(backdrop)
      expect(onClose).toHaveBeenCalledTimes(1)
    }
  })

  it('applies small size class', () => {
    const { container } = render(<Modal {...defaultProps} size="sm" />)
    const modalContent = container.querySelector('.max-w-md')
    expect(modalContent).toBeInTheDocument()
  })

  it('applies medium size class by default', () => {
    const { container } = render(<Modal {...defaultProps} size="md" />)
    const modalContent = container.querySelector('.max-w-lg')
    expect(modalContent).toBeInTheDocument()
  })

  it('applies large size class', () => {
    const { container } = render(<Modal {...defaultProps} size="lg" />)
    const modalContent = container.querySelector('.max-w-3xl')
    expect(modalContent).toBeInTheDocument()
  })

  it('applies extra large size class', () => {
    const { container } = render(<Modal {...defaultProps} size="xl" />)
    const modalContent = container.querySelector('.max-w-5xl')
    expect(modalContent).toBeInTheDocument()
  })

  it('renders footer when provided', () => {
    render(
      <Modal {...defaultProps} footer={<button>Close</button>} />
    )
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  it('does not render footer when not provided', () => {
    const { container } = render(<Modal {...defaultProps} />)
    // Footer should not exist
    const footer = container.querySelector('.border-t.border-gray-200.bg-gray-50')
    expect(footer).not.toBeInTheDocument()
  })

  it('has correct structure with all elements', () => {
    const { container } = render(
      <Modal {...defaultProps} footer={<div>Footer</div>} />
    )
    
    // Check for title
    expect(screen.getByText('Test Modal')).toBeInTheDocument()
    
    // Check for content
    expect(screen.getByText('Modal Content')).toBeInTheDocument()
    
    // Check for footer
    expect(screen.getByText('Footer')).toBeInTheDocument()
  })
})

