import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import Badge from '../Badge'

describe('Badge Component', () => {
  it('renders badge with children', () => {
    render(<Badge>Test Badge</Badge>)
    expect(screen.getByText('Test Badge')).toBeInTheDocument()
  })

  it('applies default tone styling', () => {
    const { container } = render(<Badge>Default</Badge>)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-gray-100')
    expect(badge).toHaveClass('text-gray-700')
  })

  it('applies success tone styling', () => {
    const { container } = render(<Badge tone="success">Success</Badge>)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-green-100')
    expect(badge).toHaveClass('text-green-800')
  })

  it('applies warning tone styling', () => {
    const { container } = render(<Badge tone="warning">Warning</Badge>)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-yellow-100')
    expect(badge).toHaveClass('text-yellow-800')
  })

  it('applies error tone styling', () => {
    const { container } = render(<Badge tone="error">Error</Badge>)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-red-100')
    expect(badge).toHaveClass('text-red-800')
  })

  it('applies info tone styling', () => {
    const { container } = render(<Badge tone="info">Info</Badge>)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-blue-100')
    expect(badge).toHaveClass('text-blue-800')
  })

  it('applies pending tone styling', () => {
    const { container } = render(<Badge tone="pending">Pending</Badge>)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-orange-100')
    expect(badge).toHaveClass('text-orange-800')
  })

  it('applies completed tone styling', () => {
    const { container } = render(<Badge tone="completed">Completed</Badge>)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-green-100')
    expect(badge).toHaveClass('text-green-800')
  })

  it('applies cancelled tone styling', () => {
    const { container } = render(<Badge tone="cancelled">Cancelled</Badge>)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-red-100')
    expect(badge).toHaveClass('text-red-800')
  })

  it('applies in-progress tone styling', () => {
    const { container } = render(<Badge tone="in-progress">In Progress</Badge>)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-blue-100')
    expect(badge).toHaveClass('text-blue-800')
  })

  it('applies active tone styling', () => {
    const { container } = render(<Badge tone="active">Active</Badge>)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-green-100')
    expect(badge).toHaveClass('text-green-800')
  })

  it('applies inactive tone styling', () => {
    const { container } = render(<Badge tone="inactive">Inactive</Badge>)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-gray-100')
    expect(badge).toHaveClass('text-gray-600')
  })

  it('applies available tone styling', () => {
    const { container } = render(<Badge tone="available">Available</Badge>)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-green-100')
    expect(badge).toHaveClass('text-green-800')
  })

  it('applies occupied tone styling', () => {
    const { container } = render(<Badge tone="occupied">Occupied</Badge>)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-red-100')
    expect(badge).toHaveClass('text-red-800')
  })

  it('applies paid tone styling', () => {
    const { container } = render(<Badge tone="paid">Paid</Badge>)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-green-100')
    expect(badge).toHaveClass('text-green-800')
  })

  it('applies unpaid tone styling', () => {
    const { container } = render(<Badge tone="unpaid">Unpaid</Badge>)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-red-100')
    expect(badge).toHaveClass('text-red-800')
  })

  it('applies confirmed tone styling', () => {
    const { container } = render(<Badge tone="confirmed">Confirmed</Badge>)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-green-100')
    expect(badge).toHaveClass('text-green-800')
  })

  it('applies waiting tone styling', () => {
    const { container } = render(<Badge tone="waiting">Waiting</Badge>)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-orange-100')
    expect(badge).toHaveClass('text-orange-800')
  })

  it('applies checked-in tone styling', () => {
    const { container } = render(<Badge tone="checked-in">Checked In</Badge>)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-blue-100')
    expect(badge).toHaveClass('text-blue-800')
  })

  it('applies checked-out tone styling', () => {
    const { container } = render(<Badge tone="checked-out">Checked Out</Badge>)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('bg-gray-100')
    expect(badge).toHaveClass('text-gray-600')
  })

  it('applies base styling classes', () => {
    const { container } = render(<Badge>Test</Badge>)
    const badge = container.querySelector('span')
    expect(badge).toHaveClass('inline-block')
    expect(badge).toHaveClass('rounded-md')
    expect(badge).toHaveClass('px-2')
    expect(badge).toHaveClass('text-xs')
    expect(badge).toHaveClass('font-medium')
  })
})

